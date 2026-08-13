import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ModelSpec } from "./models";
import type { InferenceResult } from "./provider";

export interface UsageEntry {
  timestamp: string;
  alias: string;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  elapsedMs: number;
}

export interface UsageSummary {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  unknownCostCalls: number;
  elapsedMs: number;
}

export function usagePath(): string {
  const state = process.env.XDG_STATE_HOME || join(process.env.HOME || "", ".local", "state");
  return join(state, "luna-ocr", "usage.jsonl");
}

export async function recordUsage(model: ModelSpec, value: InferenceResult): Promise<void> {
  const path = usagePath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const entry: UsageEntry = {
    timestamp: new Date().toISOString(), alias: model.alias, provider: model.provider,
    inputTokens: value.inputTokens, outputTokens: value.outputTokens,
    cost: value.cost, elapsedMs: value.elapsedMs,
  };
  await appendFile(path, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
}

export async function readUsage(): Promise<UsageEntry[]> {
  try {
    return (await readFile(usagePath(), "utf8")).split("\n").filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as UsageEntry]; } catch { return []; }
    });
  } catch { return []; }
}

export function summarizeUsage(entries: UsageEntry[]): Map<string, UsageSummary> {
  const summary = new Map<string, UsageSummary>();
  for (const entry of entries) {
    const row = summary.get(entry.alias) ?? { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0, unknownCostCalls: 0, elapsedMs: 0 };
    row.calls += 1;
    row.inputTokens += entry.inputTokens ?? 0;
    row.outputTokens += entry.outputTokens ?? 0;
    row.cost += entry.cost ?? 0;
    row.unknownCostCalls += entry.cost == null ? 1 : 0;
    row.elapsedMs += entry.elapsedMs;
    summary.set(entry.alias, row);
  }
  return summary;
}

export function renderUsage(entries: UsageEntry[]): string {
  const rows = [...summarizeUsage(entries)].sort((a, b) => b[1].cost - a[1].cost || a[0].localeCompare(b[0]));
  if (!rows.length) return "No model usage recorded.";
  const header = ["MODEL".padEnd(24), "CALLS".padStart(5), "INPUT".padStart(10), "OUTPUT".padStart(10), "AVG MS".padStart(9), "COST".padStart(11)].join("  ");
  const body = rows.map(([alias, row]) => [
    alias.padEnd(24), String(row.calls).padStart(5), row.inputTokens.toLocaleString().padStart(10),
    row.outputTokens.toLocaleString().padStart(10), Math.round(row.elapsedMs / row.calls).toLocaleString().padStart(9),
    (`$${row.cost.toFixed(6)}${row.unknownCostCalls ? "*" : ""}`).padStart(11),
  ].join("  "));
  const total = rows.reduce((sum, [, row]) => sum + row.cost, 0);
  const unknown = rows.reduce((sum, [, row]) => sum + row.unknownCostCalls, 0);
  return [header, "-".repeat(header.length), ...body, "", `Total estimated cost: $${total.toFixed(6)}`, ...(unknown ? [`* ${unknown} call(s) omitted cost because the provider returned no token usage.`] : [])].join("\n");
}
