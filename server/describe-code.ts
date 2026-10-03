import type { GeminiClient } from "./gemini-client.ts";

// The description is embedded and vector searched against documentation,
// so ask for prose that uses the vocabulary docs would use, not code.
const INSTRUCTIONS =
  `You are describing a code snippet so it can be matched against technical documentation.
Write a concise plain-prose description of what the code does: its purpose, the key operations and logic, and the libraries, APIs, functions, and concepts it uses (named exactly as they appear in the code).
Mention notable side effects or edge cases.
Do not repeat the code, do not use code blocks, and do not add headings or preamble.`;

export function buildDescribePrompt(code: string): string {
  return `${INSTRUCTIONS}\n\n\`\`\`\n${code}\n\`\`\``;
}

export async function describeCode(
  gemini: GeminiClient,
  code: string,
): Promise<string> {
  const description = (await gemini.ask(buildDescribePrompt(code)))
    .trim();
  if (!description) throw new Error("Gemini returned an empty description");
  return description;
}
