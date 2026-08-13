import { z } from "zod";

export const resultSchema = z.object({
  kind: z.enum(["text", "description", "empty"]),
  content: z.string(),
}).strict().superRefine((value, context) => {
  if (value.kind === "empty" && value.content !== "") context.addIssue({ code: "custom", message: "empty results must have empty content" });
  if (value.kind !== "empty" && value.content.trim() === "") context.addIssue({ code: "custom", message: "non-empty results require content" });
});

export type OcrResult = z.infer<typeof resultSchema>;

export const jsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["text", "description", "empty"] },
    content: { type: "string" },
  },
  required: ["kind", "content"],
  additionalProperties: false,
} as const;

export const SYSTEM_PROMPT = `Inspect the supplied screenshot region. Return only the requested structured object.
Rules, in strict priority order:
1. If any readable text exists, set kind to "text" and transcribe only that text literally. Preserve spelling, case, punctuation, spacing, and line breaks. Do not correct, explain, summarize, or wrap it in Markdown.
2. If there is no readable text but meaningful visual content exists, set kind to "description" and give a brief objective description.
3. If nothing discernible exists, set kind to "empty" and content to an empty string.`;
