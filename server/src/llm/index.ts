import { config } from "../config.js";
import { GroqProvider } from "./groq.js";
import { MockProvider } from "./mock.js";
import type { LLMProvider } from "./types.js";

export function createProvider(): LLMProvider {
  if (config.provider === "groq") {
    return new GroqProvider(config.apiKey, config.baseURL, config.model, config.fallbackModel);
  }
  return new MockProvider();
}
export * from "./types.js";
