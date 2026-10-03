import { assertEquals } from "@std/assert";
import { GeminiClient } from "./gemini-client.ts";

Deno.test("ask sends prompt with model and returns text", async () => {
  const calls: { model: string; contents: string }[] = [];
  const client = new GeminiClient((params) => {
    calls.push(params);
    return Promise.resolve({ text: "pong" });
  }, "test-model");

  const answer = await client.ask("ping");

  assertEquals(answer, "pong");
  assertEquals(calls, [{ model: "test-model", contents: "ping" }]);
});
