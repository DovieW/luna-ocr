import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function run(command: string[], options: { input?: string | Uint8Array } = {}): Promise<{ code: number; stdout: Uint8Array }> {
  const proc = Bun.spawn(command, { stdin: options.input == null ? "ignore" : "pipe", stdout: "pipe", stderr: "pipe" });
  if (options.input != null && proc.stdin) { proc.stdin.write(options.input); proc.stdin.end(); }
  const stdout = new Uint8Array(await new Response(proc.stdout).arrayBuffer());
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0 && code !== 130) throw new Error(stderr.trim() || `${command[0]} failed`);
  return { code, stdout };
}

export async function captureRegion(): Promise<Uint8Array | null> {
  const directory = await mkdtemp(join(tmpdir(), "luna-ocr-"));
  const path = join(directory, "capture.png");
  try {
    const proc = Bun.spawn(captureRegionCommand(path), {
      env: { ...process.env, QT_QPA_PLATFORM: "wayland" },
      stdout: "ignore",
      stderr: "pipe",
    });
    const code = await proc.exited;
    if (code !== 0 || !(await Bun.file(path).exists())) return null;
    return new Uint8Array(await Bun.file(path).arrayBuffer());
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export function captureRegionCommand(path: string): string[] {
  return ["flameshot", "gui", "--path", path, "--accept-on-select"];
}

export async function copyText(text: string): Promise<void> { await run(["wl-copy", "--type", "text/plain;charset=utf-8"], { input: text }); }
export async function notify(body: string): Promise<void> { await run(["notify-send", "--app-name=Luna OCR", "Luna OCR", body]); }
export async function commandAvailable(command: string): Promise<boolean> { try { return (await run(["sh", "-c", `command -v "$1" >/dev/null`, "sh", command])).code === 0; } catch { return false; } }
