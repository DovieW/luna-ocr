import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MODELS, modelByAlias } from "../src/models";
import { buildRequest, infer } from "../src/provider";
import { resultSchema } from "../src/schema";
import { getConfiguredModel, setConfiguredModel } from "../src/config";

let directory = "";
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "luna-ocr-test-")); process.env.XDG_CONFIG_HOME = directory; process.env.OPENAI_API_KEY = "test"; process.env.GROQ_API_KEY = "test"; });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); delete process.env.XDG_CONFIG_HOME; delete process.env.OPENAI_API_KEY; delete process.env.GROQ_API_KEY; });

test("catalog contains exactly eight direct vision models", () => { expect(MODELS).toHaveLength(8); expect(new Set(MODELS.map((model) => model.alias)).size).toBe(8); });
test("unknown model is rejected", () => expect(() => modelByAlias("bogus")).toThrow("Unknown model"));
test("empty contract rejects content", () => expect(() => resultSchema.parse({ kind: "empty", content: "x" })).toThrow());
test("literal whitespace survives validation", () => expect(resultSchema.parse({ kind: "text", content: "A\n  B" }).content).toBe("A\n  B"));
test("configuration defaults to luna and persists atomically", async () => { expect(await getConfiguredModel()).toBe("luna"); await setConfiguredModel("groq-qwen"); expect(await getConfiguredModel()).toBe("groq-qwen"); });

describe("request adapters", () => {
  test("Luna uses fast Responses and strict schema", () => { const request: any = buildRequest(modelByAlias("luna"), "data:image/png;base64,eA=="); expect(request.service_tier).toBe("fast"); expect(request.text.format.strict).toBe(true); });
  test("Groq uses JSON mode", () => { const request: any = buildRequest(modelByAlias("groq-qwen"), "data:image/png;base64,eA=="); expect(request.response_format.type).toBe("json_object"); });
});

test("inference validates and computes cost", async () => {
  const fetcher = (async () => new Response(JSON.stringify({ output_text: JSON.stringify({ kind: "text", content: "hello" }), usage: { input_tokens: 1000, output_tokens: 10 } }), { status: 200 })) as unknown as typeof fetch;
  const output = await infer(modelByAlias("gpt-5-nano"), new Uint8Array([1]), "image/png", fetcher);
  expect(output.result.content).toBe("hello");
  expect(output.cost).toBeCloseTo(0.000054);
});
