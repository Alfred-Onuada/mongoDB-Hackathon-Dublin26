import { describeCode } from "./describe-code.ts";
import type { GeminiClient } from "./gemini-client.ts";

const MAX_CODE_LENGTH = 100_000;

export interface HandlerDeps {
  gemini: GeminiClient;
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
  { gemini }: HandlerDeps,
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

  const { code } = (body ?? {}) as Record<string, unknown>;
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

  try {
    const description = await describeCode(gemini, code);
    return Response.json({ description });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to describe code with Gemini" }, {
      status: 502,
    });
  }
}
