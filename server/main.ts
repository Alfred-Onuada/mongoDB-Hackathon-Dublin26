import { createGeminiClient } from "./create-gemini-client.ts";
import { handler, type HandlerDeps } from "./handler.ts";

if (import.meta.main) {
  const deps: HandlerDeps = {
    gemini: createGeminiClient(Deno.env.get("GEMINI_MODEL")),
  };
  Deno.serve((req) => handler(req, deps));
}
