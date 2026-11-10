export const config = {
  provider: (process.env.LLM_PROVIDER ?? "mock") as "mock" | "groq",
  apiKey: process.env.GROQ_API_KEY ?? "",
  baseURL: process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1",
  model: process.env.LLM_MODEL ?? "openai/gpt-oss-120b",
  fallbackModel: process.env.LLM_FALLBACK_MODEL || undefined,
  port: Number(process.env.PORT ?? 3001),
  maxIterations: 5,
};
