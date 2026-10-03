import type { DocMatch } from "./doc-search.ts";
import type { GeminiClient } from "./gemini-client.ts";

export const NO_DOCS_COMMENT =
  "No documentation appears to be affected by this code.";

const INSTRUCTIONS =
  `You are a documentation reviewer. Below is a piece of code and the documentation sections that a similarity search found to be related to it.
Write a short review comment in Markdown that tells the team what needs to be done to the documentation so it matches the code.
For each documentation section that needs a change, give its title as a Markdown link to its URL and list the specific updates to make (what is outdated, missing, or wrong, and what it should say instead).
Leave out sections that are already accurate.
If no section needs a change, say that the documentation is up to date.
Do not add a preamble or sign-off.`;

function formatMatch(match: DocMatch, index: number): string {
  const section = match.metadata?.section
    ? `\nSection: ${match.metadata.section}`
    : "";
  return `### Documentation ${index + 1}: ${match.title}
URL: ${match.source_url}${section}
Similarity score: ${match.score.toFixed(2)}

${match.chunk_content}`;
}

export function buildCommentPrompt(
  code: string,
  description: string,
  matches: DocMatch[],
): string {
  return `${INSTRUCTIONS}

## Code

\`\`\`
${code}
\`\`\`

## What the code does

${description}

## Related documentation

${matches.map(formatMatch).join("\n\n")}`;
}

export async function writeDocComment(
  gemini: GeminiClient,
  code: string,
  description: string,
  matches: DocMatch[],
): Promise<string> {
  if (matches.length === 0) return NO_DOCS_COMMENT;
  const comment = (await gemini.ask(
    buildCommentPrompt(code, description, matches),
  )).trim();
  if (!comment) throw new Error("Gemini returned an empty comment");
  return comment;
}
