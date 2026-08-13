export type Provider = "openai" | "cerebras" | "baseten" | "groq" | "together";
export type SchemaMode = "strict" | "json";

export interface ModelSpec {
  alias: string;
  provider: Provider;
  model: string;
  endpoint: string;
  schemaMode: SchemaMode;
  inputPerMillion: number;
  outputPerMillion: number;
  responsesApi?: boolean;
  fastTier?: boolean;
}

export const MODELS: readonly ModelSpec[] = [
  { alias: "luna", provider: "openai", model: "gpt-5.6-luna", endpoint: "https://api.openai.com/v1/responses", schemaMode: "strict", inputPerMillion: 0.4, outputPerMillion: 2.4, responsesApi: true, fastTier: true },
  { alias: "gpt-5.4-nano", provider: "openai", model: "gpt-5.4-nano", endpoint: "https://api.openai.com/v1/responses", schemaMode: "strict", inputPerMillion: 0.2, outputPerMillion: 1.25, responsesApi: true },
  { alias: "gpt-5-nano", provider: "openai", model: "gpt-5-nano", endpoint: "https://api.openai.com/v1/responses", schemaMode: "strict", inputPerMillion: 0.05, outputPerMillion: 0.4, responsesApi: true },
  { alias: "cerebras-gemma", provider: "cerebras", model: "gemma-4-31b", endpoint: "https://api.cerebras.ai/v1/chat/completions", schemaMode: "strict", inputPerMillion: 2.15, outputPerMillion: 2.7 },
  { alias: "baseten-glm-fast", provider: "baseten", model: "zai-org/GLM-5.2-Fast", endpoint: "https://inference.baseten.co/v1/chat/completions", schemaMode: "strict", inputPerMillion: 2.1, outputPerMillion: 6.6 },
  { alias: "baseten-inkling-small", provider: "baseten", model: "thinkingmachines/inkling-small", endpoint: "https://inference.baseten.co/v1/chat/completions", schemaMode: "strict", inputPerMillion: 0.5, outputPerMillion: 1.2 },
  { alias: "groq-qwen", provider: "groq", model: "qwen/qwen3.6-27b", endpoint: "https://api.groq.com/openai/v1/chat/completions", schemaMode: "json", inputPerMillion: 0.6, outputPerMillion: 3 },
  { alias: "together-qwen", provider: "together", model: "Qwen/Qwen3.5-9B", endpoint: "https://api.together.xyz/v1/chat/completions", schemaMode: "strict", inputPerMillion: 0.1, outputPerMillion: 0.15 },
] as const;

export function modelByAlias(alias: string): ModelSpec {
  const model = MODELS.find((item) => item.alias === alias);
  if (!model) throw new Error(`Unknown model: ${alias}`);
  return model;
}

export const PROVIDERS = [...new Set(MODELS.map((model) => model.provider))] as Provider[];
