import { createOpenAI } from "@ai-sdk/openai";

export function getOllamaHost(): string {
    return (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
}

export function getOllamaV1BaseUrl(): string {
    return `${getOllamaHost()}/v1`;
}

export function getOllamaChatModelId(): string {
    return process.env.OLLAMA_CHAT_MODEL ?? "gpt-oss:20b";
}

/**
 * Ollama exposes an OpenAI-compatible HTTP API at `{host}/v1`.
 * AI SDK 6 requires a v2/v3 language model — `@ai-sdk/openai` satisfies that; `ollama-ai-provider` is v1-only.
 */
const ollama = createOpenAI({
    baseURL: getOllamaV1BaseUrl(),
    apiKey: process.env.OLLAMA_OPENAI_API_KEY ?? "ollama",
});

/** Chat Completions API (`/v1/chat/completions`). Default `ollama(modelId)` is Responses API (`/v1/responses`) and breaks Ollama (item_reference). */
export const chatModel = ollama.chat(getOllamaChatModelId());
