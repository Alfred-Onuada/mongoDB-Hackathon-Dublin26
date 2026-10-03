import { assertEquals, assertStringIncludes } from "@std/assert";
import { GeminiClient } from "./gemini-client.ts";
import { handler } from "./handler.ts";

function fakeGemini(reply: (prompt: string) => Promise<string>) {
  const prompts: string[] = [];
  const gemini = new GeminiClient(async ({ contents }) => {
    prompts.push(contents);
    return { text: await reply(contents) };
  }, "test-model");
  return { gemini, prompts };
}

const deps = fakeGemini(() => Promise.resolve("unused"));

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

Deno.test("/api/describe returns Gemini's description", async () => {
  const { gemini, prompts } = fakeGemini(() =>
    Promise.resolve("  Adds two numbers.\n")
  );

  const res = await handler(
    describeRequest({ code: "const add = (a, b) => a + b;", language: "js" }),
    { gemini },
  );

  assertEquals(res.status, 200);
  assertEquals(await res.json(), { description: "Adds two numbers." });
  assertEquals(prompts.length, 1);
  assertStringIncludes(prompts[0], "```js\nconst add = (a, b) => a + b;\n```");
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
  const res = await handler(describeRequest({ code: "x" }), { gemini });
  assertEquals(res.status, 502);
});

Deno.test("/api/describe returns 502 on an empty Gemini reply", async () => {
  const { gemini } = fakeGemini(() => Promise.resolve(""));
  const res = await handler(describeRequest({ code: "x" }), { gemini });
  assertEquals(res.status, 502);
});
