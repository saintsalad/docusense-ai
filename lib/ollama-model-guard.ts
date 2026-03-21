import { getOllamaChatModelId, getOllamaV1BaseUrl } from "@/lib/chat-model";

export function buildOllamaModelMissingAssistantReply(modelId: string, installedIds: string[]): string {
    const sample = installedIds.slice(0, 12);
    const listHint =
        sample.length > 0
            ? `\n\n**Some models Ollama reports as installed:** ${sample.join(", ")}${installedIds.length > 12 ? " …" : ""}`
            : "\n\n_No models were listed (is Ollama running?)._";

    return `I can’t reply yet because the configured model **\`${modelId}\`** is not available in Ollama.

**What to do**

1. Pull the model (if it exists on the registry):

\`\`\`bash
ollama pull ${modelId}
\`\`\`

2. Or point the app at a model you already have by setting **OLLAMA_CHAT_MODEL** in \`.env\` (then restart the dev server).

3. Check what you have installed: \`ollama list\`${listHint}`;
}

/**
 * If Ollama responds and the configured chat model is missing, returns `available: false`.
 * On network errors or non-OK /models responses, returns `available: true` so normal chat can still try.
 */
export async function getOllamaChatModelAvailability(): Promise<
    { available: true } | { available: false; installedIds: string[] }
> {
    const modelId = getOllamaChatModelId();
    const base = getOllamaV1BaseUrl();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const res = await fetch(`${base}/models`, {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
        });

        if (!res.ok) {
            return { available: true };
        }

        const data: unknown = await res.json();
        if (typeof data !== "object" || data === null || !("data" in data)) {
            return { available: true };
        }

        const rows = (data as { data: unknown }).data;
        if (!Array.isArray(rows)) {
            return { available: true };
        }

        const installedIds = rows
            .map((row) =>
                typeof row === "object" && row !== null && "id" in row && typeof (row as { id: unknown }).id === "string"
                    ? (row as { id: string }).id
                    : ""
            )
            .filter((id) => id.length > 0);

        if (installedIds.includes(modelId)) {
            return { available: true };
        }

        return { available: false, installedIds };
    } catch {
        return { available: true };
    } finally {
        clearTimeout(timeout);
    }
}
