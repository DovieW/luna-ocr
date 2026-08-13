import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MODELS, modelByAlias } from "../src/models";
import { buildRequest, infer } from "../src/provider";
import { resultSchema, SYSTEM_PROMPT } from "../src/schema";
import { getConfiguredModel, setConfiguredModel } from "../src/config";
import { renderUsage, summarizeUsage } from "../src/usage";
import { captureRegionCommand, notificationCommand } from "../src/desktop";
import { appendHistory, clearHistory, formatHistory, readHistory } from "../src/history";

let directory = "";
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "luna-ocr-test-")); process.env.XDG_CONFIG_HOME = directory; process.env.OPENAI_API_KEY = "test"; process.env.GROQ_API_KEY = "test"; });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); delete process.env.XDG_CONFIG_HOME; delete process.env.XDG_STATE_HOME; delete process.env.OPENAI_API_KEY; delete process.env.GROQ_API_KEY; });

test("catalog contains exactly eight direct vision models", () => { expect(MODELS).toHaveLength(8); expect(new Set(MODELS.map((model) => model.alias)).size).toBe(8); });
test("region capture bypasses the screenshot editor", () => {
  expect(captureRegionCommand("/tmp/capture.png")).toEqual([
    "flameshot", "gui", "--path", "/tmp/capture.png", "--accept-on-select",
  ]);
});
test("clipboard notification is brief, transient, and replaceable", () => {
  const command = notificationCommand("Copied: hello");
  expect(command).toContain("--transient");
  expect(command).toContain("--expire-time=2000");
  expect(command).toContain("--hint=string:x-canonical-private-synchronous:luna-ocr");
});
test("unknown model is rejected", () => expect(() => modelByAlias("bogus")).toThrow("Unknown model"));
test("empty contract rejects content", () => expect(() => resultSchema.parse({ kind: "empty", content: "x" })).toThrow());
test("literal whitespace survives validation", () => expect(resultSchema.parse({ kind: "text", content: "A\n  B" }).content).toBe("A\n  B"));
test("prompt always returns readable text in English", () => {
  expect(SYSTEM_PROMPT).toContain("Return all text in English");
  expect(SYSTEM_PROMPT).toContain("translate any non-English or mixed-language text");
  expect(SYSTEM_PROMPT).toContain("Do not explain, summarize, include the source text");
});
test("prompt names confidently recognized subjects before describing them", () => {
  expect(SYSTEM_PROMPT).toContain("confidently recognizable conventional identity");
  expect(SYSTEM_PROMPT).toContain("return only its canonical name");
  expect(SYSTEM_PROMPT).toContain("without guessing its identity");
});
test("assistant history retains only five explicitly labeled responses", async () => {
  process.env.XDG_STATE_HOME = directory;
  for (let index = 1; index <= 6; index += 1) await appendHistory(`answer ${index}`);
  const entries = await readHistory();
  expect(entries.map((entry) => entry.content)).toEqual(["answer 2", "answer 3", "answer 4", "answer 5", "answer 6"]);
  expect(formatHistory(entries)).toContain("Prior response 1");
  await clearHistory();
  expect(await readHistory()).toEqual([]);
});
test("configuration defaults to luna and persists atomically", async () => { expect(await getConfiguredModel()).toBe("luna"); await setConfiguredModel("groq-qwen"); expect(await getConfiguredModel()).toBe("groq-qwen"); });

describe("request adapters", () => {
  test("Luna uses fast Responses and strict schema", () => { const request: any = buildRequest(modelByAlias("luna"), "data:image/png;base64,eA=="); expect(request.service_tier).toBe("fast"); expect(request.text.format.strict).toBe(true); });
  test("custom assistant requests keep system instructions separate", () => {
    const request: any = buildRequest(modelByAlias("luna"), "data:image/png;base64,eA==", { systemPrompt: "system", userText: "question" });
    expect(request.input[0]).toEqual({ role: "system", content: "system" });
    expect(request.input[1].content[0].text).toBe("question");
  });
  test("Groq uses JSON mode", () => { const request: any = buildRequest(modelByAlias("groq-qwen"), "data:image/png;base64,eA=="); expect(request.response_format.type).toBe("json_object"); });
});

test("inference validates and computes cost", async () => {
  const fetcher = (async () => new Response(JSON.stringify({ output_text: JSON.stringify({ kind: "text", content: "hello" }), usage: { input_tokens: 1000, output_tokens: 10 } }), { status: 200 })) as unknown as typeof fetch;
  const output = await infer(modelByAlias("gpt-5-nano"), new Uint8Array([1]), "image/png", fetcher);
  expect(output.result.content).toBe("hello");
  expect(output.cost).toBeCloseTo(0.000054);
});

test("usage summary aggregates models and marks unknown costs", () => {
  const entries = [
    { timestamp: "2026-01-01T00:00:00Z", alias: "luna", provider: "openai", inputTokens: 100, outputTokens: 5, cost: 0.001, elapsedMs: 200 },
    { timestamp: "2026-01-01T00:00:01Z", alias: "luna", provider: "openai", elapsedMs: 400 },
  ];
  const row = summarizeUsage(entries).get("luna")!;
  expect(row.calls).toBe(2);
  expect(row.unknownCostCalls).toBe(1);
  expect(renderUsage(entries)).toContain("Total estimated cost: $0.001000");
});
