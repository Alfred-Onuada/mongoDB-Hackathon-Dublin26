// Ingestion pipeline: walks a folder for .mdx files and emits a JSON array
// of documentation chunks matching the Documentation schema (schema.ts).
//
// Usage:
//   deno run --allow-read --allow-write ingest.ts <docs-folder> [output.json]
//
// Then insert with mongoimport:
//   mongoimport --uri "$MONGODB_URI" --collection documentations --jsonArray --file chunks.json
// or via mongoose: Documentation.insertMany(JSON.parse(await Deno.readTextFile("chunks.json")))

import { walk } from "jsr:@std/fs@1/walk";
import { relative } from "jsr:@std/path@1";

interface Frontmatter {
  title?: string;
  source_url?: string;
  tags?: string[];
  [key: string]: unknown;
}

interface DocumentationChunk {
  _id: string;
  title: string;
  source_url: string;
  file_type: string;
  chunk_index: number;
  chunk_content: string;
  metadata: {
    section?: string;
    associated_paths: string[];
    tags: string[];
  };
}

const MAX_CHUNK_CHARS = 5000;

/** Minimal YAML frontmatter parser: handles `key: value`, inline arrays, and `- item` lists. */
function parseFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: {}, body: raw };

  const frontmatter: Frontmatter = {};
  let currentKey: string | null = null;

  for (const line of match[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && currentKey) {
      const existing = frontmatter[currentKey];
      frontmatter[currentKey] = Array.isArray(existing)
        ? [...existing, listItem[1].trim()]
        : [listItem[1].trim()];
      continue;
    }
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    currentKey = kv[1];
    const value = kv[2].trim().replace(/^["']|["']$/g, "");
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[currentKey] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else if (value) {
      frontmatter[currentKey] = value;
    } else {
      frontmatter[currentKey] = []; // key with no value, expect a list
    }
  }
  return { frontmatter, body: raw.slice(match[0].length) };
}

/** Strip MDX noise so chunk_content embeds cleanly: imports/exports and JSX wrapper tags. */
function cleanMdx(body: string): string {
  return body
    .replace(/^import\s.+$/gm, "")
    .replace(/^export\s.+$/gm, "")
    .replace(/<\/?[A-Z][\w.]*(\s[^>]*)?\/?>/g, "") // component tags like <Callout>
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "") // MDX comments
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split markdown into sections by headings, then split oversized sections by paragraphs. */
function chunkMarkdown(body: string): { section?: string; content: string }[] {
  const sections: { section?: string; content: string }[] = [];
  const lines = body.split("\n");
  let currentSection: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join("\n").trim();
    if (content) sections.push({ section: currentSection, content });
    buffer = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) {
      flush();
      currentSection = heading[1].trim();
    }
    buffer.push(line);
  }
  flush();

  // Split any section that exceeds the size cap by paragraphs.
  const chunks: { section?: string; content: string }[] = [];
  for (const { section, content } of sections) {
    if (content.length <= MAX_CHUNK_CHARS) {
      chunks.push({ section, content });
      continue;
    }
    let piece = "";
    for (const para of content.split(/\n\n+/)) {
      if (piece && piece.length + para.length > MAX_CHUNK_CHARS) {
        chunks.push({ section, content: piece.trim() });
        piece = "";
      }
      piece += para + "\n\n";
    }
    if (piece.trim()) chunks.push({ section, content: piece.trim() });
  }

  // Hard-split any chunk still over the cap (e.g. one giant code block or table
  // with no blank lines), breaking at the nearest whitespace.
  return chunks.flatMap(({ section, content }) => {
    const pieces: { section?: string; content: string }[] = [];
    let rest = content;
    while (rest.length > MAX_CHUNK_CHARS) {
      const breakAt = rest.lastIndexOf(" ", MAX_CHUNK_CHARS) > MAX_CHUNK_CHARS / 2
        ? rest.lastIndexOf(" ", MAX_CHUNK_CHARS)
        : MAX_CHUNK_CHARS;
      pieces.push({ section, content: rest.slice(0, breakAt).trim() });
      rest = rest.slice(breakAt).trim();
    }
    if (rest) pieces.push({ section, content: rest });
    return pieces;
  });
}

/** Collapse newlines and runs of whitespace into single spaces to minimize stored bytes. */
function compactWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function slugify(path: string): string {
  return path.replace(/\.mdx$/, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
}

// Python stdlib modules that show up in doc examples but never map to repo code.
const PY_STDLIB = new Set([
  "os", "sys", "getpass", "json", "re", "typing", "asyncio", "time", "datetime",
  "math", "random", "uuid", "pathlib", "collections", "functools", "itertools",
  "logging", "subprocess", "io", "base64", "abc", "enum", "dataclasses", "operator",
]);

/**
 * Extract code references from a chunk — import module paths and installed
 * package names — so a code diff can be matched to docs via associated_paths.
 */
function extractCodeRefs(content: string): string[] {
  const refs = new Set<string>();
  const addPy = (mod: string) => {
    if (!PY_STDLIB.has(mod.split(".")[0])) refs.add(mod);
  };

  // Python: `from x.y import z` and bare `import x.y` (lowercase-first to skip JS symbols)
  for (const m of content.matchAll(/^\s*from\s+([a-zA-Z_][\w.]*)\s+import\b/gm)) addPy(m[1]);
  for (const m of content.matchAll(/^\s*import\s+([a-z_][\w.]*)\s*$/gm)) addPy(m[1]);

  // JS/TS: import ... from "pkg" and require("pkg"), skipping relative paths
  for (const m of content.matchAll(/from\s+["']([^"']+)["']/g)) {
    if (!m[1].startsWith(".")) refs.add(m[1]);
  }
  for (const m of content.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) {
    if (!m[1].startsWith(".")) refs.add(m[1]);
  }

  // Install commands: pip/uv/npm/yarn/pnpm/bun — package names minus flags and version pins
  for (const m of content.matchAll(/^\s*\$?\s*(?:pip|uv|npm|yarn|pnpm|bun)\s+(?:install|add|i)\s+(.+)$/gm)) {
    for (const token of m[1].split(/\s+/)) {
      const pkg = token.replace(/^["']|["',]$/g, "").replace(/[=<>~^[].*$/, "");
      if (/^@?[a-zA-Z][\w@/.-]*$/.test(pkg)) refs.add(pkg);
    }
  }
  return [...refs].sort();
}

/**
 * LangChain docs (Mintlify): paths under src/ map to docs.langchain.com URLs.
 * Snippets are transcluded partials with no page of their own, so link to GitHub.
 */
function deriveSourceUrl(relPath: string): string {
  const pagePath = relPath.replace(/\.mdx$/, "").replace(/\/index$/, "");
  if (pagePath.startsWith("snippets/")) {
    return `https://github.com/langchain-ai/docs/blob/main/src/${relPath}`;
  }
  return `https://docs.langchain.com/${pagePath}`;
}

async function ingest(docsDir: string, maxFiles = Infinity): Promise<DocumentationChunk[]> {
  const docs: DocumentationChunk[] = [];
  let fileCount = 0;

  for await (const entry of walk(docsDir, { exts: [".mdx"], includeDirs: false })) {
    if (fileCount >= maxFiles) break;
    const relPath = relative(docsDir, entry.path);
    const raw = await Deno.readTextFile(entry.path);
    const { frontmatter, body } = parseFrontmatter(raw);
    const cleaned = cleanMdx(body);

    const title = frontmatter.title ??
      cleaned.match(/^#\s+(.*)$/m)?.[1] ??
      relPath.replace(/\.mdx$/, "");
    const sourceUrl = frontmatter.source_url ?? deriveSourceUrl(relPath);
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    const idBase = slugify(relPath);

    chunkMarkdown(cleaned).forEach((chunk, i) => {
      docs.push({
        _id: `${idBase}#${i}`,
        title,
        source_url: sourceUrl,
        file_type: "mdx",
        chunk_index: i,
        chunk_content: compactWhitespace(chunk.content),
        metadata: {
          section: chunk.section,
          associated_paths: [relPath, ...extractCodeRefs(chunk.content)],
          tags,
        },
      });
    });
    fileCount++;
    if (fileCount % 200 === 0) console.error(`  ...${fileCount} files processed`);
  }
  console.error(`Processed ${fileCount} files`);
  return docs;
}

if (import.meta.main) {
  const docsDir = Deno.args[0];
  if (!docsDir) {
    console.error("Usage: deno run --allow-read --allow-write ingest.ts <docs-folder> [output.json] [maxFiles]");
    Deno.exit(1);
  }
  const outFile = Deno.args[1] ?? "chunks.json";
  const maxFiles = Deno.args[2] ? Number(Deno.args[2]) : Infinity;

  console.error(`Ingesting .mdx files from ${docsDir} ...`);
  const docs = await ingest(docsDir, maxFiles);
  await Deno.writeTextFile(outFile, JSON.stringify(docs, null, 2));
  console.error(`Wrote ${docs.length} chunks to ${outFile}`);
}

export { chunkMarkdown, cleanMdx, ingest, parseFrontmatter };
