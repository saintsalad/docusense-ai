import fs from "fs";
import path from "path";
import { z } from "zod";

export const CHATBOT_CONFIG_FILENAME = "chatbot-config.json";

/** Used when `aiName` is missing or empty in `data/chatbot-config.json`. */
export const DEFAULT_AI_NAME = "Assistant";

const AI_NAME_MAX = 80;
const AI_PERSONALITY_MAX = 8_000;

const fileSchema = z.object({
    aiName: z.string().max(AI_NAME_MAX).optional(),
    aiPersonality: z.string().max(AI_PERSONALITY_MAX).optional(),
    /** When false, model behaves as a peer participant—not a task-taking assistant (no “how can I help?”). */
    assistantMode: z.boolean().optional(),
    ollamaChatModel: z.string().min(1).max(200).optional(),
    chatTemperature: z.number().min(0).max(2).optional(),
    knowledgeSearchNResults: z.number().int().min(1).max(50).optional(),
});

export type ChatbotConfigFile = z.infer<typeof fileSchema>;

export function getChatbotConfigPath(): string {
    return path.join(process.cwd(), "data", CHATBOT_CONFIG_FILENAME);
}

export function readChatbotConfigFile(): ChatbotConfigFile {
    try {
        const raw = fs.readFileSync(getChatbotConfigPath(), "utf8").replace(/^\uFEFF/, "");
        const j: unknown = JSON.parse(raw);
        const p = fileSchema.safeParse(j);
        return p.success ? p.data : {};
    } catch {
        return {};
    }
}

export function writeChatbotConfigFile(
    partial: ChatbotConfigFile,
    options?: { clearAiPersonality?: boolean }
): void {
    const dir = path.dirname(getChatbotConfigPath());
    fs.mkdirSync(dir, { recursive: true });
    const prev = readChatbotConfigFile();
    const merged: ChatbotConfigFile = { ...prev, ...partial };
    if (options?.clearAiPersonality) {
        delete merged.aiPersonality;
    }
    fs.writeFileSync(getChatbotConfigPath(), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
}

function sanitizeAiName(raw: string): string {
    let v = raw.trim().replace(/\s+/g, " ");
    if (v.length > AI_NAME_MAX) v = v.slice(0, AI_NAME_MAX).trim();
    return v;
}

function truncatePersonality(raw: string): string {
    if (raw.length <= AI_PERSONALITY_MAX) return raw;
    return raw.slice(0, AI_PERSONALITY_MAX);
}

/** Resolved name: non-empty `aiName` in JSON; otherwise `DEFAULT_AI_NAME`. */
export function getChatAiName(): string {
    const f = readChatbotConfigFile();
    if (f.aiName !== undefined) {
        const t = f.aiName.trim();
        if (t.length > 0) return sanitizeAiName(t);
    }
    return DEFAULT_AI_NAME;
}

/**
 * Resolved persona: non-empty `aiPersonality` in JSON.
 * Empty / whitespace-only in JSON (or omitted key) means no extra persona block in the system prompt.
 */
export function getChatAiPersonality(): string | undefined {
    const f = readChatbotConfigFile();
    if (f.aiPersonality !== undefined) {
        const t = f.aiPersonality.trim();
        if (t.length > 0) return truncatePersonality(t);
    }
    return undefined;
}

function getEnvOllamaChatModelId(): string {
    return process.env.OLLAMA_CHAT_MODEL?.trim() || "gpt-oss:20b";
}

export function getResolvedOllamaChatModelId(): string {
    const f = readChatbotConfigFile();
    const m = f.ollamaChatModel?.trim();
    if (m && m.length > 0) return m;
    return getEnvOllamaChatModelId();
}

export function getChatTemperature(): number {
    const f = readChatbotConfigFile();
    if (f.chatTemperature !== undefined && Number.isFinite(f.chatTemperature)) {
        return Math.min(2, Math.max(0, f.chatTemperature));
    }
    return 0;
}

function parseEnvKnowledgeSearchNResults(): number {
    const raw = process.env.KNOWLEDGE_SEARCH_N_RESULTS;
    if (raw === undefined || raw === "") return 12;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return 12;
    return Math.min(n, 50);
}

export function getKnowledgeSearchNResults(): number {
    const f = readChatbotConfigFile();
    if (f.knowledgeSearchNResults !== undefined && Number.isFinite(f.knowledgeSearchNResults)) {
        return Math.min(50, Math.max(1, Math.floor(f.knowledgeSearchNResults)));
    }
    return parseEnvKnowledgeSearchNResults();
}

/** Default true. Set `assistantMode: false` in JSON for peer / non-assistant behavior. */
export function getAssistantMode(): boolean {
    const f = readChatbotConfigFile();
    if (f.assistantMode === false) return false;
    return true;
}

/** Values for the admin settings form (file field if set; else built-in / env defaults for other fields). */
export function getChatbotSettingsFormValues(): {
    aiName: string;
    aiPersonality: string;
    assistantMode: boolean;
    ollamaChatModel: string;
    chatTemperature: number;
    knowledgeSearchNResults: number;
} {
    const f = readChatbotConfigFile();
    const storedPersona = f.aiPersonality;
    const personaForForm =
        storedPersona !== undefined && storedPersona.trim() !== "" ? storedPersona : "";
    return {
        aiName: f.aiName !== undefined ? f.aiName : DEFAULT_AI_NAME,
        aiPersonality: personaForForm,
        assistantMode: f.assistantMode !== false,
        ollamaChatModel: f.ollamaChatModel !== undefined ? f.ollamaChatModel : getEnvOllamaChatModelId(),
        chatTemperature: f.chatTemperature !== undefined ? f.chatTemperature : 0,
        knowledgeSearchNResults:
            f.knowledgeSearchNResults !== undefined ? f.knowledgeSearchNResults : parseEnvKnowledgeSearchNResults(),
    };
}
