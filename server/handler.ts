import { describeCode } from "./describe-code.ts";
import type { DocMatch, DocSearch } from "./doc-search.ts";
import type { GeminiClient } from "./gemini-client.ts";
import { writeDocComment } from "./write-comment.ts";

const MAX_CODE_LENGTH = 100_000;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

export interface HandlerDeps {
  gemini: GeminiClient;
  docSearch: DocSearch;
  // Minimum vectorSearchScore for a doc chunk to count as related.
  minScore: number;
}

export async function handler(
  req: Request,
  deps: HandlerDeps,
): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/api") {
    return Response.json({
      message: "Hello, world!",
      time: new Date().toISOString(),
    });
  }

  if (url.pathname === "/api/describe") {
    return await handleDescribe(req, deps);
  }

  return new Response("<h1>Welcome to Deno!</h1>", {
    headers: { "content-type": "text/html" },
  });
}

async function handleDescribe(
  req: Request,
  { gemini, docSearch, minScore }: HandlerDeps,
): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, {
      status: 405,
      headers: { allow: "POST" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON" }, {
      status: 400,
    });
  }

  const { code, limit = DEFAULT_LIMIT } = (body ?? {}) as Record<
    string,
    unknown
  >;
  if (typeof code !== "string" || code.trim() === "") {
    return Response.json({ error: "`code` must be a non-empty string" }, {
      status: 400,
    });
  }
  if (code.length > MAX_CODE_LENGTH) {
    return Response.json({
      error: `\`code\` must be at most ${MAX_CODE_LENGTH} characters`,
    }, { status: 413 });
  }
  if (
    typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 ||
    limit > MAX_LIMIT
  ) {
    return Response.json({
      error: `\`limit\` must be an integer from 1 to ${MAX_LIMIT}`,
    }, { status: 400 });
  }

  let description: string;
  try {
    description = await describeCode(gemini, code);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to describe code with Gemini" }, {
      status: 502,
    });
  }

  let matches: DocMatch[];
  try {
    matches = await docSearch.search(description, { limit, minScore });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to search documentation" }, {
      status: 502,
    });
  }

  try {
    const comment = await writeDocComment(gemini, code, description, matches);
    return Response.json({ description, matches, comment });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to write comment with Gemini" }, {
      status: 502,
    });
  }
}
