import type { ModelSpec } from "./models";
import { jsonSchema, resultSchema, SYSTEM_PROMPT, type OcrResult } from "./schema";
import { readApiKey } from "./credentials";

export interface InferenceResult {
  result: OcrResult;
  elapsedMs: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
}

export interface InferenceOptions {
  systemPrompt?: string;
  userText?: string;
}

function dataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

export function buildRequest(model: ModelSpec, image: string, options: InferenceOptions = {}): Record<string, unknown> {
  const systemPrompt = options.systemPrompt ?? SYSTEM_PROMPT;
  const userText = options.userText ?? "Process this image.";
  if (model.responsesApi) {
    return {
      model: model.model,
      service_tier: model.fastTier ? "fast" : undefined,
      reasoning: { effort: "none" },
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: [{ type: "input_text", text: userText }, { type: "input_image", image_url: image, detail: "original" }] },
      ],
      text: { format: { type: "json_schema", name: "ocr_result", strict: true, schema: jsonSchema } },
    };
  }
  return {
    model: model.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: [{ type: "text", text: userText }, { type: "image_url", image_url: { url: image, detail: "auto" } }] },
    ],
    reasoning_effort: model.provider === "cerebras" || model.provider === "groq" ? "none" : undefined,
    reasoning: model.provider === "baseten" || model.provider === "together" ? { enabled: false } : undefined,
    response_format: model.schemaMode === "strict"
      ? { type: "json_schema", json_schema: { name: "ocr_result", strict: true, schema: jsonSchema } }
      : { type: "json_object" },
  };
}

function outputText(model: ModelSpec, body: any): string {
  if (model.responsesApi) return body.output_text ?? body.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.type === "output_text")?.text ?? "";
  return body.choices?.[0]?.message?.content ?? "";
}

export async function infer(model: ModelSpec, bytes: Uint8Array, mime = "image/png", fetcher: typeof fetch = fetch, options: InferenceOptions = {}): Promise<InferenceResult> {
  const key = await readApiKey(model.provider);
  const started = performance.now();
  const response = await fetcher(model.endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildRequest(model, dataUrl(bytes, mime), options)),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${model.provider} returned HTTP ${response.status}`);
  const body: any = await response.json();
  const result = resultSchema.parse(JSON.parse(outputText(model, body)));
  const inputTokens = body.usage?.input_tokens ?? body.usage?.prompt_tokens;
  const outputTokens = body.usage?.output_tokens ?? body.usage?.completion_tokens;
  const cost = inputTokens == null || outputTokens == null ? undefined : (inputTokens * model.inputPerMillion + outputTokens * model.outputPerMillion) / 1_000_000;
  return { result, elapsedMs: performance.now() - started, inputTokens, outputTokens, cost };
}
