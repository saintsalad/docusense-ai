import fs from "fs";
import path from "path";
import { z } from "zod";
import { getEnvChatAiName, getEnvChatAiPersonality } from "@/lib/env-server";

export const CHATBOT_CONFIG_FILENAME = "chatbot-config.json";

const AI_NAME_MAX = 80;
const AI_PERSONALITY_MAX = 8_000;

const fileSchema = z.object({
    aiName: z.string().max(AI_NAME_MAX).optional(),
    aiPersonality: z.string().max(AI_PERSONALITY_MAX).optional(),
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
        const raw = fs.readFileSync(getChatbotConfigPath(), "utf8");
        const j: unknown = JSON.parse(raw);
        const p = fileSchema.safeParse(j);
        return p.success ? p.data : {};
    } catch {
        return {};
    }
}

export function writeChatbotConfigFile(partial: ChatbotConfigFile): void {
    const dir = path.dirname(getChatbotConfigPath());
    fs.mkdirSync(dir, { recursive: true });
    const prev = readChatbotConfigFile();
    const merged: ChatbotConfigFile = { ...prev, ...partial };
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

/** Resolved name: JSON file overrides env when `aiName` is set and non-empty after trim. */
export function getChatAiName(): string {
    const f = readChatbotConfigFile();
    if (f.aiName !== undefined) {
        const t = f.aiName.trim();
        if (t.length > 0) return sanitizeAiName(t);
    }
    return getEnvChatAiName();
}

/** Resolved persona: JSON overrides env when `aiPersonality` key is present (empty = none). */
export function getChatAiPersonality(): string | undefined {
    const f = readChatbotConfigFile();
    if (f.aiPersonality !== undefined) {
        const t = f.aiPersonality.trim();
        return t.length > 0 ? truncatePersonality(t) : undefined;
    }
    return getEnvChatAiPersonality();
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

/** Values for the admin settings form (per-field: file value if key exists, else env default). */
export function getChatbotSettingsFormValues(): {
    aiName: string;
    aiPersonality: string;
    ollamaChatModel: string;
    chatTemperature: number;
    knowledgeSearchNResults: number;
} {
    const f = readChatbotConfigFile();
    return {
        aiName: f.aiName !== undefined ? f.aiName : getEnvChatAiName(),
        aiPersonality: f.aiPersonality !== undefined ? f.aiPersonality : (getEnvChatAiPersonality() ?? ""),
        ollamaChatModel: f.ollamaChatModel !== undefined ? f.ollamaChatModel : getEnvOllamaChatModelId(),
        chatTemperature: f.chatTemperature !== undefined ? f.chatTemperature : 0,
        knowledgeSearchNResults:
            f.knowledgeSearchNResults !== undefined ? f.knowledgeSearchNResults : parseEnvKnowledgeSearchNResults(),
    };
}
