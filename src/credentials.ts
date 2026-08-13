import { access, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import type { Provider } from "./models";

export function credentialName(provider: Provider): string {
  return `luna-ocr-${provider}-api-key`;
}

export function credentialPath(provider: Provider): string {
  const root = process.env.XDG_CONFIG_HOME || join(process.env.HOME || "", ".config");
  return join(root, "credstore.encrypted", credentialName(provider));
}

export async function credentialExists(provider: Provider): Promise<boolean> {
  try { await access(credentialPath(provider)); return true; } catch { return false; }
}

export async function setCredential(provider: Provider): Promise<void> {
  if (!process.stdin.isTTY) throw new Error("Credential entry requires a terminal");
  const destination = credentialPath(provider);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  const stty = async (...args: string[]) => {
    const child = Bun.spawn(["stty", ...args], { stdin: "inherit", stdout: "ignore", stderr: "inherit" });
    if (await child.exited !== 0) throw new Error(`stty ${args.join(" ")} failed`);
  };
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  let secret = "";
  await stty("-echo");
  try {
    secret = await terminal.question(`Paste the ${provider} API key (input hidden), then press Enter: `);
  } finally {
    terminal.close();
    await stty("echo");
    process.stdout.write("\n");
  }
  if (!secret.trim()) throw new Error("Credential entry cancelled");
  const proc = Bun.spawn(["systemd-creds", "encrypt", "--user", `--name=${credentialName(provider)}`, "-", destination], { stdin: "pipe", stdout: "inherit", stderr: "inherit" });
  proc.stdin.write(secret.trim());
  proc.stdin.end();
  const code = await proc.exited;
  if (code !== 0) throw new Error(`systemd-creds failed with exit code ${code}`);
  console.log(`Stored encrypted ${provider} credential at ${destination}`);
}

export async function removeCredential(provider: Provider): Promise<void> {
  await rm(credentialPath(provider), { force: true });
}

export async function readApiKey(provider: Provider): Promise<string> {
  const envName = `${provider.toUpperCase()}_API_KEY`;
  const direct = process.env[envName];
  if (direct) return direct.trim();
  const file = process.env[`${envName}_FILE`];
  if (file) return (await Bun.file(file).text()).trim();
  throw new Error(`Missing ${envName}; run luna-ocr credentials set ${provider}`);
}
