# luna-ocr

Fast screen-region OCR for Linux using eight cloud vision models. A Flameshot selection becomes literal clipboard text; regions without readable text become a short visual description; blank regions leave the clipboard untouched.

## Models

OpenAI GPT-5.6 Luna Fast (default), GPT-5.4 Nano, GPT-5 Nano, Cerebras Gemma 4 31B, Baseten GLM-5.2 Fast and Inkling Small, Groq Qwen 3.6 27B, and Together Qwen 3.5 9B.

## Install

Download `luna-ocr-linux-x64` and its checksum from the latest GitHub release, verify it, and place it on `PATH`. Runtime dependencies are `flameshot`, `wl-clipboard`, `libnotify-bin`, `systemd-creds`, and optionally ImageMagick.

```bash
luna-ocr credentials set openai
luna-ocr capture
luna-ocr model set groq-qwen
luna-ocr compare screenshot.png
luna-ocr usage
```

The credential command waits without expiring. Paste only the provider's API key at the masked prompt, then press Enter.

API keys are accepted through provider environment variables for portable use. On a systemd desktop, `credentials set` stores user-scoped encrypted credentials under `~/.config/credstore.encrypted`; plaintext is never written by luna-ocr.

`luna-ocr usage` displays calls, tokens, average latency, and estimated spend per model. The append-only ledger under `$XDG_STATE_HOME/luna-ocr/usage.jsonl` contains metrics only—never screenshots or extracted content. Use `--json` for machine-readable totals.

## Privacy

The selected image is sent to the configured cloud provider. Screenshots and model output are not retained locally by luna-ocr. Check each provider's data policy before processing sensitive material.

## Development

```bash
npm install
npm test
npm run check
npm run build
```
