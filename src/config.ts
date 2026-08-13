import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function configPath(): string {
  return join(process.env.XDG_CONFIG_HOME || join(process.env.HOME || "", ".config"), "luna-ocr", "config.json");
}

export async function getConfiguredModel(): Promise<string> {
  try {
    const parsed = JSON.parse(await readFile(configPath(), "utf8"));
    return typeof parsed.model === "string" ? parsed.model : "luna";
  } catch {
    return "luna";
  }
}

export async function setConfiguredModel(model: string): Promise<void> {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ model }, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}
