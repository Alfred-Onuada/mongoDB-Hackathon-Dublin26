import { GoogleGenAI } from "@google/genai";
import { GeminiClient } from "./gemini-client.ts";

export function createGeminiClient(model?: string): GeminiClient {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey });
  return new GeminiClient((p) => ai.models.generateContent(p), model);
}
