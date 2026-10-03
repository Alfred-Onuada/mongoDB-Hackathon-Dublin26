import { assertEquals, assertStringIncludes } from "@std/assert";
import { type DocMatch, DocSearch } from "./doc-search.ts";
import { GeminiClient } from "./gemini-client.ts";
import { handler, type HandlerDeps } from "./handler.ts";
import { NO_DOCS_COMMENT } from "./write-comment.ts";

const isCommentPrompt = (prompt: string) =>
  prompt.startsWith("You are a documentation reviewer");

// Replies with `description` to the describe prompt and `comment` to the
// comment prompt.
function fakeGeminiFor(
  { description, comment }: {
    description: () => Promise<string>;
    comment: () => Promise<string>;
  },
) {
  return fakeGemini((prompt) =>
    isCommentPrompt(prompt) ? comment() : description()
  );
}

function fakeGemini(reply: (prompt: string) => Promise<string>) {
  const prompts: string[] = [];
  const gemini = new GeminiClient(async ({ contents }) => {
    prompts.push(contents);
    return { text: await reply(contents) };
  }, "test-model");
  return { gemini, prompts };
}

const sampleMatch: DocMatch = {
  _id: "doc-1",
  title: "Arrow functions",
  source_url: "https://example.com/arrow-functions",
  chunk_index: 0,
  chunk_content: "Arrow functions are a compact function syntax.",
  score: 0.91,
};

function fakeDocSearch(
  result: () => Promise<DocMatch[]> = () => Promise.resolve([sampleMatch]),
) {
  const searches: { text: string; limit: number; minScore: number }[] = [];
  const docSearch = new DocSearch(async (pipeline) => {
    const stage = pipeline[0].$vectorSearch as {
      query: { text: string };
      limit: number;
    };
    const match = pipeline.at(-1)!.$match as { score: { $gte: number } };
    searches.push({
      text: stage.query.text,
      limit: stage.limit,
      minScore: match.score.$gte,
    });
    return await result();
  });
  return { docSearch, searches };
}

const deps: HandlerDeps = {
  gemini: fakeGemini(() => Promise.resolve("unused")).gemini,
  docSearch: fakeDocSearch().docSearch,
  minScore: 0.7,
};

function describeRequest(body: unknown): Request {
  return new Request("http://localhost/api/describe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

Deno.test("returns html on /", async () => {
  const res = await handler(new Request("http://localhost/"), deps);
  assertEquals(res.headers.get("content-type"), "text/html");
  const body = await res.text();
  assertEquals(body.includes("Welcome to Deno"), true);
});

Deno.test("returns json on /api", async () => {
  const res = await handler(new Request("http://localhost/api"), deps);
  const data = await res.json();
  assertEquals(data.message, "Hello, world!");
  assertEquals(typeof data.time, "string");
});

Deno.test("/api/describe returns the matching docs and a comment", async () => {
  const { gemini, prompts } = fakeGeminiFor({
    description: () => Promise.resolve("  Adds two numbers.\n"),
    comment: () => Promise.resolve("  Update [Arrow functions](url).\n"),
  });
  const { docSearch, searches } = fakeDocSearch();

  const res = await handler(
    describeRequest({
      code: "const add = (a, b) => a + b;",
      limit: 3,
    }),
    { gemini, docSearch, minScore: 0.8 },
  );

  assertEquals(res.status, 200);
  assertEquals(await res.json(), {
    description: "Adds two numbers.",
    matches: [sampleMatch],
    comment: "Update [Arrow functions](url).",
  });
  assertEquals(prompts.length, 2);
  assertStringIncludes(prompts[0], "```\nconst add = (a, b) => a + b;\n```");
  assertEquals(searches, [{
    text: "Adds two numbers.",
    limit: 3,
    minScore: 0.8,
  }]);
  assertStringIncludes(prompts[1], "const add = (a, b) => a + b;");
  assertStringIncludes(prompts[1], "Adds two numbers.");
  assertStringIncludes(prompts[1], sampleMatch.title);
  assertStringIncludes(prompts[1], sampleMatch.source_url);
  assertStringIncludes(prompts[1], sampleMatch.chunk_content);
});

Deno.test("/api/describe searches 5 docs by default", async () => {
  const { gemini } = fakeGemini(() => Promise.resolve("desc"));
  const { docSearch, searches } = fakeDocSearch();
  await handler(describeRequest({ code: "x" }), { ...deps, gemini, docSearch });
  assertEquals(searches, [{ text: "desc", limit: 5, minScore: 0.7 }]);
});

Deno.test("/api/describe says no docs are affected when nothing matches", async () => {
  const { gemini, prompts } = fakeGemini(() => Promise.resolve("desc"));
  const { docSearch } = fakeDocSearch(() => Promise.resolve([]));
  const res = await handler(describeRequest({ code: "x" }), {
    ...deps,
    gemini,
    docSearch,
  });
  assertEquals(res.status, 200);
  assertEquals(await res.json(), {
    description: "desc",
    matches: [],
    comment: NO_DOCS_COMMENT,
  });
  assertEquals(prompts.length, 1);
});

Deno.test("/api/describe rejects an invalid limit", async () => {
  for (const limit of [0, 21, 2.5, "5"]) {
    const res = await handler(describeRequest({ code: "x", limit }), deps);
    assertEquals(res.status, 400, `limit ${JSON.stringify(limit)}`);
  }
});

Deno.test("/api/describe rejects non-POST", async () => {
  const res = await handler(
    new Request("http://localhost/api/describe"),
    deps,
  );
  assertEquals(res.status, 405);
});

Deno.test("/api/describe rejects invalid JSON", async () => {
  const res = await handler(describeRequest("not json"), deps);
  assertEquals(res.status, 400);
});

Deno.test("/api/describe rejects missing code", async () => {
  const res = await handler(describeRequest({ code: "   " }), deps);
  assertEquals(res.status, 400);
});

Deno.test("/api/describe rejects oversized code", async () => {
  const res = await handler(
    describeRequest({ code: "x".repeat(100_001) }),
    deps,
  );
  assertEquals(res.status, 413);
});

Deno.test("/api/describe returns 502 when Gemini fails", async () => {
  const { gemini } = fakeGemini(() => Promise.reject(new Error("quota")));
  const res = await handler(describeRequest({ code: "x" }), {
    ...deps,
    gemini,
  });
  assertEquals(res.status, 502);
});

Deno.test("/api/describe returns 502 on an empty Gemini reply", async () => {
  const { gemini } = fakeGemini(() => Promise.resolve(""));
  const res = await handler(describeRequest({ code: "x" }), {
    ...deps,
    gemini,
  });
  assertEquals(res.status, 502);
});

Deno.test("/api/describe returns 502 when the doc search fails", async () => {
  const { gemini } = fakeGemini(() => Promise.resolve("desc"));
  const { docSearch } = fakeDocSearch(() =>
    Promise.reject(new Error("index not found"))
  );
  const res = await handler(describeRequest({ code: "x" }), {
    ...deps,
    gemini,
    docSearch,
  });
  assertEquals(res.status, 502);
  assertEquals(
    (await res.json()).error,
    "Failed to search documentation",
  );
});

Deno.test("/api/describe returns 502 when writing the comment fails", async () => {
  const { gemini } = fakeGeminiFor({
    description: () => Promise.resolve("desc"),
    comment: () => Promise.reject(new Error("quota")),
  });
  const res = await handler(describeRequest({ code: "x" }), {
    ...deps,
    gemini,
  });
  assertEquals(res.status, 502);
  assertEquals(
    (await res.json()).error,
    "Failed to write comment with Gemini",
  );
});

Deno.test("/api/describe returns 502 on an empty comment", async () => {
  const { gemini } = fakeGeminiFor({
    description: () => Promise.resolve("desc"),
    comment: () => Promise.resolve("  "),
  });
  const res = await handler(describeRequest({ code: "x" }), {
    ...deps,
    gemini,
  });
  assertEquals(res.status, 502);
});
