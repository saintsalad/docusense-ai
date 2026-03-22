import fs from "fs";
import path from "path";
import { z } from "zod";
import {
    DEFAULT_AI_NAME,
    getChatAiName,
    getChatAiPersonality,
    getAssistantMode,
    getResolvedOllamaChatModelId,
    getChatTemperature,
    getKnowledgeSearchNResults,
} from "@/lib/chatbot-config";

/* ─── Schema ─────────────────────────────────────────────────────────────── */

const AGENT_NAME_MAX = 80;
const AGENT_AI_NAME_MAX = 80;
const AGENT_PERSONALITY_MAX = 8_000;

export const agentToolsSchema = z.object({
    searchKnowledgeBase: z.boolean().default(true),
});
export type AgentTools = z.infer<typeof agentToolsSchema>;

export const agentSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(AGENT_NAME_MAX),
    aiName: z.string().max(AGENT_AI_NAME_MAX).default(DEFAULT_AI_NAME),
    personality: z.string().max(AGENT_PERSONALITY_MAX).default(""),
    assistantMode: z.boolean().default(true),
    ollamaChatModel: z.string().min(1).max(200),
    chatTemperature: z.number().min(0).max(2).default(0),
    knowledgeSearchNResults: z.number().int().min(1).max(50).default(12),
    tools: agentToolsSchema.default({ searchKnowledgeBase: true }),
    createdAt: z.string(),
});
export type Agent = z.infer<typeof agentSchema>;

const agentsFileSchema = z.object({
    activeAgentId: z.string().nullable().default(null),
    agents: z.array(agentSchema).default([]),
});
export type AgentsFile = z.infer<typeof agentsFileSchema>;

/* ─── Persistence ────────────────────────────────────────────────────────── */

const AGENTS_FILENAME = "agents.json";

function getAgentsFilePath(): string {
    return path.join(process.cwd(), "data", AGENTS_FILENAME);
}

export function readAgentsFile(): AgentsFile {
    try {
        const raw = fs.readFileSync(getAgentsFilePath(), "utf8").replace(/^\uFEFF/, "");
        const parsed = agentsFileSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : { activeAgentId: null, agents: [] };
    } catch {
        return { activeAgentId: null, agents: [] };
    }
}

export function writeAgentsFile(data: AgentsFile): void {
    const dir = path.dirname(getAgentsFilePath());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getAgentsFilePath(), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/* ─── CRUD helpers ───────────────────────────────────────────────────────── */

export function listAgents(): Agent[] {
    return readAgentsFile().agents;
}

export function getAgentById(id: string): Agent | null {
    return readAgentsFile().agents.find((a) => a.id === id) ?? null;
}

export function createAgent(input: Omit<Agent, "id" | "createdAt">): Agent {
    const file = readAgentsFile();
    const agent: Agent = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };
    file.agents.push(agent);
    writeAgentsFile(file);
    return agent;
}

export function updateAgent(id: string, patch: Partial<Omit<Agent, "id" | "createdAt">>): Agent | null {
    const file = readAgentsFile();
    const idx = file.agents.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    const updated: Agent = { ...file.agents[idx], ...patch };
    file.agents[idx] = updated;
    writeAgentsFile(file);
    return updated;
}

export function deleteAgent(id: string): boolean {
    const file = readAgentsFile();
    const before = file.agents.length;
    file.agents = file.agents.filter((a) => a.id !== id);
    if (file.activeAgentId === id) file.activeAgentId = file.agents[0]?.id ?? null;
    if (file.agents.length === before) return false;
    writeAgentsFile(file);
    return true;
}

export function getActiveAgentId(): string | null {
    return readAgentsFile().activeAgentId;
}

export function setActiveAgentId(id: string | null): void {
    const file = readAgentsFile();
    file.activeAgentId = id;
    writeAgentsFile(file);
}

export function getActiveAgent(): Agent | null {
    const file = readAgentsFile();
    if (!file.activeAgentId) return null;
    return file.agents.find((a) => a.id === file.activeAgentId) ?? null;
}

/* ─── Config bridge ──────────────────────────────────────────────────────── */

export type ActiveAgentConfig = {
    aiName: string;
    personality: string | undefined;
    assistantMode: boolean;
    ollamaChatModel: string;
    chatTemperature: number;
    knowledgeSearchNResults: number;
    tools: AgentTools;
};

/**
 * Returns config values from the active agent.
 * Falls back to the global chatbot-config.json values when no active agent is set.
 */
export function getActiveAgentConfig(): ActiveAgentConfig {
    const agent = getActiveAgent();
    if (agent) {
        return {
            aiName: agent.aiName.trim() || DEFAULT_AI_NAME,
            personality: agent.personality.trim() || undefined,
            assistantMode: agent.assistantMode,
            ollamaChatModel: agent.ollamaChatModel,
            chatTemperature: agent.chatTemperature,
            knowledgeSearchNResults: agent.knowledgeSearchNResults,
            tools: agent.tools,
        };
    }
    // Fallback to global config
    return {
        aiName: getChatAiName(),
        personality: getChatAiPersonality(),
        assistantMode: getAssistantMode(),
        ollamaChatModel: getResolvedOllamaChatModelId(),
        chatTemperature: getChatTemperature(),
        knowledgeSearchNResults: getKnowledgeSearchNResults(),
        tools: { searchKnowledgeBase: true },
    };
}

/**
 * Returns config for a specific agent by ID.
 * Returns null if the agent does not exist, in which case the caller should
 * fall back to getActiveAgentConfig().
 */
export function getAgentConfigById(id: string): ActiveAgentConfig | null {
    const agent = getAgentById(id);
    if (!agent) return null;
    return {
        aiName: agent.aiName.trim() || DEFAULT_AI_NAME,
        personality: agent.personality.trim() || undefined,
        assistantMode: agent.assistantMode,
        ollamaChatModel: agent.ollamaChatModel,
        chatTemperature: agent.chatTemperature,
        knowledgeSearchNResults: agent.knowledgeSearchNResults,
        tools: agent.tools,
    };
}
