import { createDocSearch } from "./create-doc-search.ts";
import { createGeminiClient } from "./create-gemini-client.ts";
import { handler, type HandlerDeps } from "./handler.ts";

const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

function similarityThreshold(): number {
  const raw = Deno.env.get("SIMILARITY_THRESHOLD");
  if (raw === undefined || raw === "") return DEFAULT_SIMILARITY_THRESHOLD;
  const threshold = Number(raw);
  if (!(threshold >= 0 && threshold <= 1)) {
    throw new Error("SIMILARITY_THRESHOLD must be a number from 0 to 1");
  }
  return threshold;
}

if (import.meta.main) {
  const deps: HandlerDeps = {
    gemini: createGeminiClient(Deno.env.get("GEMINI_MODEL")),
    docSearch: await createDocSearch(Deno.env.get("VECTOR_INDEX_NAME")),
    minScore: similarityThreshold(),
  };
  Deno.serve((req) => handler(req, deps));
}
