import { assertEquals, assertStringIncludes } from "@std/assert";
import type { DocMatch } from "./doc-search.ts";
import { GeminiClient } from "./gemini-client.ts";
import {
  buildCommentPrompt,
  NO_DOCS_COMMENT,
  writeDocComment,
} from "./write-comment.ts";

const match: DocMatch = {
  _id: "doc-1",
  title: "Configuration",
  source_url: "https://example.com/config",
  chunk_index: 2,
  chunk_content: "Set TIMEOUT to control request timeouts.",
  metadata: { section: "Environment variables" },
  score: 0.8765,
};

Deno.test("buildCommentPrompt includes each doc with its section and score", () => {
  const prompt = buildCommentPrompt("code()", "Calls code.", [
    match,
    { ...match, _id: "doc-2", title: "Other", metadata: undefined },
  ]);
  assertStringIncludes(prompt, "### Documentation 1: Configuration");
  assertStringIncludes(prompt, "URL: https://example.com/config");
  assertStringIncludes(prompt, "Section: Environment variables");
  assertStringIncludes(prompt, "Similarity score: 0.88");
  assertStringIncludes(prompt, "Set TIMEOUT to control request timeouts.");
  assertStringIncludes(prompt, "### Documentation 2: Other");
  assertEquals(prompt.match(/Section:/g)?.length, 1);
});

Deno.test("writeDocComment skips Gemini when no docs matched", async () => {
  let calls = 0;
  const gemini = new GeminiClient(() => {
    calls++;
    return Promise.resolve({ text: "unused" });
  });
  assertEquals(await writeDocComment(gemini, "x", "y", []), NO_DOCS_COMMENT);
  assertEquals(calls, 0);
});
