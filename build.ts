const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  target: "bun",
  minify: true,
  compile: { outfile: "./dist/luna-ocr" },
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

export {};
