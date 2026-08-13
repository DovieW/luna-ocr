import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface AssistantHistoryEntry {
  timestamp: string;
  content: string;
}

export function historyPath(): string {
  const state = process.env.XDG_STATE_HOME || join(process.env.HOME || "", ".local", "state");
  return join(state, "luna-ocr", "assistant-history.json");
}

export async function readHistory(): Promise<AssistantHistoryEntry[]> {
  try {
    const parsed = JSON.parse(await readFile(historyPath(), "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => typeof item?.timestamp === "string" && typeof item?.content === "string"
      ? [{ timestamp: item.timestamp, content: item.content }]
      : []).slice(-5);
  } catch { return []; }
}

export async function appendHistory(content: string): Promise<void> {
  const path = historyPath();
  const entries = [...await readHistory(), { timestamp: new Date().toISOString(), content }].slice(-5);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

export async function clearHistory(): Promise<void> {
  await rm(historyPath(), { force: true });
}

export function formatHistory(entries: AssistantHistoryEntry[]): string {
  if (!entries.length) return "No prior responses are available.";
  return entries.map((entry, index) => `Prior response ${index + 1} (${entry.timestamp}):\n${entry.content}`).join("\n\n");
}
