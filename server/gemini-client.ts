export const DEFAULT_MODEL = "gemini-2.5-flash";

export interface GenerateFn {
  (params: { model: string; contents: string }): Promise<{ text?: string }>;
}

export class GeminiClient {
  constructor(
    private readonly generate: GenerateFn, // for testability
    private readonly model = DEFAULT_MODEL,
  ) {}

  async ask(prompt: string): Promise<string> {
    const res = await this.generate({ model: this.model, contents: prompt });
    return res.text ?? "";
  }
}
