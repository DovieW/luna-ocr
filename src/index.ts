#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { MODELS, PROVIDERS, modelByAlias, type Provider } from "./models";
import { getConfiguredModel, setConfiguredModel } from "./config";
import { credentialExists, removeCredential, setCredential } from "./credentials";
import { infer } from "./provider";
import { captureRegion, commandAvailable, copyText, notify } from "./desktop";
import { readUsage, recordUsage, renderUsage, summarizeUsage } from "./usage";

const VERSION = "0.1.6";
const args = process.argv.slice(2);

function option(name: string): string | undefined { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; }
function provider(value: string | undefined): Provider {
  if (!value) throw new Error(`Missing provider. Choose one of: ${PROVIDERS.join(", ")}`);
  if (!PROVIDERS.includes(value as Provider)) throw new Error(`Unknown provider: ${value}. Choose one of: ${PROVIDERS.join(", ")}`);
  return value as Provider;
}
function preview(text: string): string { const line = text.split(/\r?\n/, 1)[0] ?? ""; return line.length > 120 ? `${line.slice(0, 117)}...` : line; }

function printHelp(): void {
  console.log(`Usage: luna-ocr <command> [options]

Commands:
  capture                         Select a region and copy its OCR result
  extract [IMAGE]                 Extract from an image, or select a region
  compare [IMAGE]                 Compare supported models
  model list|get|set <MODEL>      List or choose the default model
  credentials set <PROVIDER>      Securely enter and encrypt an API key
  credentials status <PROVIDER>   Check whether an encrypted key exists
  credentials remove <PROVIDER>   Remove an encrypted key
  usage [--json]                  Summarize requests, tokens, latency, and cost
  doctor                          Check runtime dependencies and credentials
  version                         Print the installed version

Providers: ${PROVIDERS.join(", ")}

Example: luna-ocr credentials set openai`);
}

async function imageFromArgument(position: number): Promise<Uint8Array | null> {
  const path = args[position];
  return path && !path.startsWith("-") ? new Uint8Array(await readFile(path)) : captureRegion();
}

async function main(): Promise<void> {
  const command = args[0] ?? "help";
  if (command === "help" || command === "--help" || command === "-h") return printHelp();
  if (command === "version" || command === "--version") return console.log(`luna-ocr ${VERSION}`);
  if (command === "model") {
    const action = args[1];
    if (action === "list") { for (const model of MODELS) console.log(`${model.alias}\t${model.provider}\t${model.model}`); return; }
    if (action === "get") return console.log(await getConfiguredModel());
    if (action === "set") { modelByAlias(args[2] ?? ""); await setConfiguredModel(args[2]!); return console.log(`Default model: ${args[2]}`); }
  }
  if (command === "credentials") {
    const action = args[1];
    if (action === "help" || action === "--help" || !action) {
      console.log("Usage: luna-ocr credentials set|status|remove <openai|cerebras|baseten|groq|together>");
      return;
    }
    if (!["set", "status", "remove"].includes(action)) throw new Error(`Unknown credentials action: ${action}`);
    const selected = provider(args[2]);
    if (action === "set") return setCredential(selected);
    if (action === "remove") { await removeCredential(selected); return console.log(`Removed ${selected} credential`); }
    if (action === "status") return console.log(`${selected}: ${(await credentialExists(selected)) ? "configured" : "missing"}`);
  }
  if (command === "doctor") {
    let failed = false;
    for (const tool of ["flameshot", "wl-copy", "notify-send", "systemd-creds"]) { const ok = await commandAvailable(tool); console.log(`${ok ? "ok" : "missing"}\t${tool}`); failed ||= !ok; }
    for (const item of PROVIDERS) console.log(`${await credentialExists(item) ? "ok" : "optional"}\t${item} credential`);
    if (failed) process.exitCode = 1;
    return;
  }
  if (command === "usage") {
    const entries = await readUsage();
    if (args.includes("--json")) {
      return console.log(JSON.stringify(Object.fromEntries(summarizeUsage(entries)), null, 2));
    }
    return console.log(renderUsage(entries));
  }
  if (command === "capture" || command === "extract") {
    const selected = modelByAlias(option("--model") ?? await getConfiguredModel());
    const bytes = command === "capture" ? await captureRegion() : await imageFromArgument(1);
    if (!bytes) return;
    const inference = await infer(selected, bytes);
    await recordUsage(selected, inference);
    const output = inference.result;
    if (command === "extract") return console.log(args.includes("--json") ? JSON.stringify(output) : output.content);
    if (output.kind === "empty") return;
    await copyText(output.content);
    await notify(`Copied: ${preview(output.content)}`);
    return;
  }
  if (command === "compare") {
    const bytes = await imageFromArgument(1);
    if (!bytes) return;
    const aliases = option("--models")?.split(",") ?? MODELS.map((model) => model.alias);
    const selected = aliases.map(modelByAlias);
    const outcomes = await Promise.all(selected.map(async (model) => {
      try {
        const value = await infer(model, bytes);
        await recordUsage(model, value);
        return { model, value };
      } catch (error) { return { model, error: error instanceof Error ? error.message : String(error) }; }
    }));
    for (const outcome of outcomes) {
      if ("error" in outcome) console.log(`${outcome.model.alias}\tERROR\t${outcome.error}`);
      else console.log(`${outcome.model.alias}\t${outcome.value.result.kind}\t${outcome.value.elapsedMs.toFixed(0)}ms\t${outcome.value.cost == null ? "-" : `$${outcome.value.cost.toFixed(6)}`}\n${outcome.value.result.content}\n`);
    }
    return;
  }
  throw new Error(`Unknown command: ${command}. Run luna-ocr help.`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`luna-ocr: ${message}`);
  if (args[0] === "capture") try { await notify(`OCR failed: ${preview(message)}`); } catch {}
  process.exitCode = 1;
});
