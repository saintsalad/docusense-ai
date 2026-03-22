"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
    Bot,
    Plus,
    Trash2,
    Save,
    Loader2,
    AlertCircle,
    CheckCircle,
    Zap,
    Brain,
    Wrench,
    Database,
    Settings,
    UserCircle,
    ChevronRight,
    RotateCcw,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type AgentTools = {
    searchKnowledgeBase: boolean;
};

type Agent = {
    id: string;
    name: string;
    aiName: string;
    personality: string;
    assistantMode: boolean;
    ollamaChatModel: string;
    chatTemperature: number;
    knowledgeSearchNResults: number;
    tools: AgentTools;
    createdAt: string;
};

type AgentForm = Omit<Agent, "id" | "createdAt">;

/* ─── Constants ──────────────────────────────────────────────────────────── */

const DEFAULT_FORM: AgentForm = {
    name: "",
    aiName: "Assistant",
    personality: "",
    assistantMode: true,
    ollamaChatModel: "gpt-oss:20b",
    chatTemperature: 0,
    knowledgeSearchNResults: 12,
    tools: { searchKnowledgeBase: true },
};

const TOOL_META: { key: keyof AgentTools; label: string; description: string }[] = [
    {
        key: "searchKnowledgeBase",
        label: "Knowledge base search",
        description: "Lets the agent recall from your uploaded documents during chat.",
    },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function agentToForm(a: Agent): AgentForm {
    return {
        name: a.name,
        aiName: a.aiName,
        personality: a.personality,
        assistantMode: a.assistantMode,
        ollamaChatModel: a.ollamaChatModel,
        chatTemperature: a.chatTemperature,
        knowledgeSearchNResults: a.knowledgeSearchNResults,
        tools: { ...a.tools },
    };
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function StatusBanner({
    error,
    success,
}: {
    error: string | null;
    success: string | null;
}) {
    if (error) {
        return (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
            </div>
        );
    }
    if (success) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-100">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {success}
            </div>
        );
    }
    return null;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {children}
        </p>
    );
}

/* ─── Agent list sidebar ─────────────────────────────────────────────────── */

function AgentSidebar({
    agents,
    activeAgentId,
    selectedId,
    onSelect,
    onNew,
    loading,
}: {
    agents: Agent[];
    activeAgentId: string | null;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    loading: boolean;
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Agents</p>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onNew}
                    disabled={loading}
                    className="h-7 gap-1.5 px-2 text-xs"
                >
                    <Plus className="size-3.5" />
                    New
                </Button>
            </div>

            {agents.length === 0 && !loading ? (
                <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    No agents yet.
                    <br />
                    Click <strong>New</strong> to create one.
                </div>
            ) : (
                <div className="space-y-1">
                    {agents.map((agent) => {
                        const isActive = agent.id === activeAgentId;
                        const isSelected = agent.id === selectedId;
                        return (
                            <button
                                key={agent.id}
                                type="button"
                                onClick={() => onSelect(agent.id)}
                                className={cn(
                                    "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                                    "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                                    isSelected ? "bg-muted/70" : ""
                                )}
                            >
                                <div
                                    className={cn(
                                        "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                                        isActive
                                            ? "border-primary/20 bg-primary/10 text-primary"
                                            : "border-border bg-muted/50 text-muted-foreground"
                                    )}
                                >
                                    <Bot className="size-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-medium leading-tight text-foreground">
                                        {agent.name}
                                    </p>
                                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                        {agent.aiName}
                                    </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                    {isActive && (
                                        <Badge
                                            variant="outline"
                                            className="h-4 border-primary/30 bg-primary/10 px-1.5 text-[9px] font-semibold text-primary"
                                        >
                                            Active
                                        </Badge>
                                    )}
                                    <ChevronRight
                                        className={cn(
                                            "size-3.5 text-muted-foreground/50 transition-opacity",
                                            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                                        )}
                                    />
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ─── Agent editor ───────────────────────────────────────────────────────── */

function AgentEditor({
    agent,
    isActive,
    saving,
    deleting,
    settingActive,
    error,
    success,
    onSave,
    onSetActive,
    onDelete,
    isNew,
}: {
    agent: AgentForm;
    isActive: boolean;
    saving: boolean;
    deleting: boolean;
    settingActive: boolean;
    error: string | null;
    success: string | null;
    onSave: (form: AgentForm) => void;
    onSetActive: () => void;
    onDelete: () => void;
    isNew: boolean;
}) {
    const [form, setForm] = useState<AgentForm>(agent);

    // Sync when the parent switches to a different agent
    useEffect(() => {
        setForm(agent);
    }, [agent]);

    const busy = saving || deleting || settingActive;

    const set = <K extends keyof AgentForm>(key: K, value: AgentForm[K]) =>
        setForm((f) => ({ ...f, [key]: value }));

    return (
        <div className="space-y-5">
            <StatusBanner error={error} success={success} />

            {/* ── Identity & Persona ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <UserCircle className="size-4 shrink-0" />
                        Identity &amp; Persona
                    </CardTitle>
                    <CardDescription className="text-xs">
                        How this agent presents itself and behaves in every conversation.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Display name */}
                    <div className="space-y-1.5">
                        <label htmlFor="agent-name" className="text-sm font-medium">
                            Agent display name
                        </label>
                        <Input
                            id="agent-name"
                            value={form.name}
                            onChange={(e) => set("name", e.target.value)}
                            placeholder="e.g. Support Bot"
                            maxLength={80}
                            disabled={busy}
                        />
                        <p className="text-xs text-muted-foreground">
                            Used in the admin interface to identify this agent.
                        </p>
                    </div>

                    {/* AI name */}
                    <div className="space-y-1.5">
                        <label htmlFor="agent-ainame" className="text-sm font-medium">
                            AI name
                        </label>
                        <Input
                            id="agent-ainame"
                            value={form.aiName}
                            onChange={(e) => set("aiName", e.target.value)}
                            placeholder="Assistant"
                            maxLength={80}
                            disabled={busy}
                        />
                        <p className="text-xs text-muted-foreground">
                            The name the AI uses when referring to itself in chat.
                        </p>
                    </div>

                    <Separator />

                    {/* Assistant mode */}
                    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                        <div className="space-y-0.5">
                            <p className="text-sm font-medium">Assistant mode</p>
                            <p className="text-xs text-muted-foreground">
                                <strong>On:</strong> helpful assistant style, offers help proactively.{" "}
                                <strong>Off:</strong> peer participant — no &quot;how can I help?&quot; framing.
                            </p>
                        </div>
                        <Switch
                            checked={form.assistantMode}
                            onCheckedChange={(v) => set("assistantMode", v)}
                            disabled={busy}
                            className="shrink-0 mt-0.5"
                        />
                    </div>

                    {/* Personality */}
                    <div className="space-y-1.5">
                        <label htmlFor="agent-personality" className="text-sm font-medium">
                            Persona
                        </label>
                        <Textarea
                            id="agent-personality"
                            value={form.personality}
                            onChange={(e) => set("personality", e.target.value)}
                            rows={10}
                            className="min-h-[200px] resize-y font-mono text-sm"
                            placeholder={`Describe tone, communication style, domain expertise, and any behavioral rules.\n\nExamples:\n- Speak concisely, always back claims with data.\n- You are an expert DevOps engineer; use precise technical language.\n- You are warm and encouraging; avoid jargon.`}
                            maxLength={8000}
                            disabled={busy}
                        />
                        <p className="text-xs text-muted-foreground">
                            {form.personality.length.toLocaleString()} / 8,000 — Injected verbatim into the
                            system prompt. Leave blank for no persona block.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* ── Model ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Brain className="size-4 shrink-0" />
                        Model
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Ollama model and inference settings for this agent.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <label htmlFor="agent-model" className="text-sm font-medium">
                            Model ID
                        </label>
                        <Input
                            id="agent-model"
                            value={form.ollamaChatModel}
                            onChange={(e) => set("ollamaChatModel", e.target.value)}
                            placeholder="qwen3.5:9b"
                            disabled={busy}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="agent-temp" className="text-sm font-medium">
                            Temperature{" "}
                            <span className="font-mono text-xs text-muted-foreground">
                                ({form.chatTemperature.toFixed(1)})
                            </span>
                        </label>
                        <input
                            id="agent-temp"
                            type="range"
                            min={0}
                            max={2}
                            step={0.1}
                            value={form.chatTemperature}
                            onChange={(e) =>
                                set("chatTemperature", Math.round(Number.parseFloat(e.target.value) * 10) / 10)
                            }
                            disabled={busy}
                            className="h-2 w-full cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>0 — Precise</span>
                            <span>1 — Balanced</span>
                            <span>2 — Creative</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── Knowledge base ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Database className="size-4 shrink-0" />
                        Knowledge base
                    </CardTitle>
                    <CardDescription className="text-xs">
                        How many document chunks to retrieve per query for this agent.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <label htmlFor="agent-kb" className="text-sm font-medium">
                            Chunks (top K)
                        </label>
                        <Input
                            id="agent-kb"
                            type="number"
                            min={1}
                            max={50}
                            value={form.knowledgeSearchNResults}
                            onChange={(e) => {
                                const n = Number.parseInt(e.target.value, 10);
                                set(
                                    "knowledgeSearchNResults",
                                    Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 12
                                );
                            }}
                            disabled={busy}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* ── Tools ── */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Wrench className="size-4 shrink-0" />
                        Tools
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Enable or disable capabilities this agent can invoke during chat. DEBUG tools
                        (KB add / update / delete) are always controlled by the server{" "}
                        <code className="text-[10px]">DEBUG</code> flag.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {TOOL_META.map(({ key, label, description }) => (
                        <div
                            key={key}
                            className="flex items-start justify-between gap-4 rounded-lg border p-3"
                        >
                            <div className="space-y-0.5">
                                <p className="text-sm font-medium">{label}</p>
                                <p className="text-xs text-muted-foreground">{description}</p>
                            </div>
                            <Switch
                                checked={form.tools[key]}
                                onCheckedChange={(v) =>
                                    setForm((f) => ({ ...f, tools: { ...f.tools, [key]: v } }))
                                }
                                disabled={busy}
                                className="mt-0.5 shrink-0"
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* ── Actions ── */}
            <div className="flex flex-wrap items-center gap-2 pb-2">
                {!isNew && (
                    <Button
                        type="button"
                        variant={isActive ? "secondary" : "default"}
                        onClick={onSetActive}
                        disabled={busy || isActive}
                        className="gap-2"
                    >
                        {settingActive ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Zap className="size-4" />
                        )}
                        {isActive ? "Currently active" : "Set as active"}
                    </Button>
                )}
                <Button
                    type="button"
                    onClick={() => onSave(form)}
                    disabled={busy || !form.name.trim() || !form.aiName.trim() || !form.ollamaChatModel.trim()}
                    className="gap-2"
                >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {isNew ? "Create agent" : "Save changes"}
                </Button>
                {!isNew && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onDelete}
                        disabled={busy}
                        className="ml-auto gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                        {deleting ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Trash2 className="size-4" />
                        )}
                        Delete agent
                    </Button>
                )}
            </div>
        </div>
    );
}

/* ─── Global defaults card ───────────────────────────────────────────────── */

type GlobalConfig = {
    ollamaChatModel: string;
    chatTemperature: number;
    knowledgeSearchNResults: number;
};

function GlobalDefaultsCard() {
    const [cfg, setCfg] = useState<GlobalConfig>({
        ollamaChatModel: "gpt-oss:20b",
        chatTemperature: 0,
        knowledgeSearchNResults: 12,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch("/api/chatbot-config", { cache: "no-store" });
                const data = (await res.json()) as { ok?: boolean; config?: GlobalConfig };
                if (data.ok && data.config) setCfg(data.config);
            } catch {
                // ignore
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            const res = await fetch("/api/chatbot-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cfg),
            });
            const data = (await res.json()) as { ok?: boolean; error?: unknown };
            if (!res.ok || !data.ok) {
                setError(typeof data.error === "string" ? data.error : "Save failed");
                return;
            }
            setSaved(true);
        } catch {
            setError("Network error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return null;

    return (
        <Card className="mt-6">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Settings className="size-4 shrink-0" />
                    Global defaults
                </CardTitle>
                <CardDescription className="text-xs">
                    Fallback model and KB settings used when no agent is active. Stored in{" "}
                    <code className="text-[10px]">data/chatbot-config.json</code>.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <StatusBanner error={error} success={saved ? "Global defaults saved." : null} />
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Model ID</label>
                        <Input
                            value={cfg.ollamaChatModel}
                            onChange={(e) => setCfg((c) => ({ ...c, ollamaChatModel: e.target.value }))}
                            placeholder="gpt-oss:20b"
                            disabled={saving}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Temperature</label>
                        <Input
                            type="number"
                            step={0.1}
                            min={0}
                            max={2}
                            value={cfg.chatTemperature}
                            onChange={(e) => {
                                const n = Number.parseFloat(e.target.value);
                                setCfg((c) => ({
                                    ...c,
                                    chatTemperature: Number.isFinite(n) ? Math.min(2, Math.max(0, n)) : 0,
                                }));
                            }}
                            disabled={saving}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">KB chunks (top K)</label>
                        <Input
                            type="number"
                            min={1}
                            max={50}
                            value={cfg.knowledgeSearchNResults}
                            onChange={(e) => {
                                const n = Number.parseInt(e.target.value, 10);
                                setCfg((c) => ({
                                    ...c,
                                    knowledgeSearchNResults: Number.isFinite(n)
                                        ? Math.min(50, Math.max(1, n))
                                        : 12,
                                }));
                            }}
                            disabled={saving}
                        />
                    </div>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="gap-2"
                >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save defaults
                </Button>
            </CardContent>
        </Card>
    );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function ChatbotSettings() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isNewAgent, setIsNewAgent] = useState(false);
    const [editorForm, setEditorForm] = useState<AgentForm>(DEFAULT_FORM);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [settingActive, setSettingActive] = useState(false);
    const [editorError, setEditorError] = useState<string | null>(null);
    const [editorSuccess, setEditorSuccess] = useState<string | null>(null);

    /* ── Load ── */
    const loadAgents = useCallback(async () => {
        setLoading(true);
        try {
            const [listRes, activeRes] = await Promise.all([
                fetch("/api/agents", { cache: "no-store" }),
                fetch("/api/agents/active", { cache: "no-store" }),
            ]);
            const listData = (await listRes.json()) as { ok?: boolean; agents?: Agent[] };
            const activeData = (await activeRes.json()) as {
                ok?: boolean;
                activeAgentId?: string | null;
            };
            const loadedAgents = listData.ok && listData.agents ? listData.agents : [];
            const loadedActiveId =
                activeData.ok && activeData.activeAgentId !== undefined
                    ? activeData.activeAgentId
                    : null;
            setAgents(loadedAgents);
            setActiveAgentId(loadedActiveId);

            // Auto-select active or first agent
            const toSelect = loadedActiveId ?? loadedAgents[0]?.id ?? null;
            if (toSelect) {
                const a = loadedAgents.find((x) => x.id === toSelect);
                if (a) {
                    setSelectedId(a.id);
                    setEditorForm(agentToForm(a));
                    setIsNewAgent(false);
                }
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadAgents();
    }, [loadAgents]);

    /* ── Select agent ── */
    const handleSelectAgent = (id: string) => {
        const a = agents.find((x) => x.id === id);
        if (!a) return;
        setSelectedId(id);
        setEditorForm(agentToForm(a));
        setIsNewAgent(false);
        setEditorError(null);
        setEditorSuccess(null);
    };

    /* ── New agent ── */
    const handleNewAgent = () => {
        setSelectedId(null);
        setIsNewAgent(true);
        setEditorForm({ ...DEFAULT_FORM });
        setEditorError(null);
        setEditorSuccess(null);
    };

    /* ── Save (create or update) ── */
    const handleSave = async (form: AgentForm) => {
        setSaving(true);
        setEditorError(null);
        setEditorSuccess(null);
        try {
            if (isNewAgent) {
                const res = await fetch("/api/agents", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                });
                const data = (await res.json()) as { ok?: boolean; agent?: Agent; error?: unknown };
                if (!res.ok || !data.ok || !data.agent) {
                    setEditorError(
                        typeof data.error === "string" ? data.error : "Failed to create agent."
                    );
                    return;
                }
                const newAgent = data.agent;
                setAgents((prev) => [...prev, newAgent]);
                setSelectedId(newAgent.id);
                setIsNewAgent(false);
                setEditorForm(agentToForm(newAgent));
                setEditorSuccess("Agent created.");
            } else {
                if (!selectedId) return;
                const res = await fetch(`/api/agents/${selectedId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                });
                const data = (await res.json()) as { ok?: boolean; agent?: Agent; error?: unknown };
                if (!res.ok || !data.ok || !data.agent) {
                    setEditorError(
                        typeof data.error === "string" ? data.error : "Failed to save agent."
                    );
                    return;
                }
                const updated = data.agent;
                setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
                setEditorForm(agentToForm(updated));
                setEditorSuccess("Changes saved.");
            }
        } catch {
            setEditorError("Network error.");
        } finally {
            setSaving(false);
        }
    };

    /* ── Set active ── */
    const handleSetActive = async () => {
        if (!selectedId) return;
        setSettingActive(true);
        setEditorError(null);
        setEditorSuccess(null);
        try {
            const res = await fetch("/api/agents/active", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activeAgentId: selectedId }),
            });
            const data = (await res.json()) as { ok?: boolean; error?: unknown };
            if (!res.ok || !data.ok) {
                setEditorError(
                    typeof data.error === "string" ? data.error : "Failed to set active agent."
                );
                return;
            }
            setActiveAgentId(selectedId);
            setEditorSuccess("Agent set as active.");
        } catch {
            setEditorError("Network error.");
        } finally {
            setSettingActive(false);
        }
    };

    /* ── Delete ── */
    const handleDelete = async () => {
        if (!selectedId) return;
        if (!window.confirm("Delete this agent? This cannot be undone.")) return;
        setDeleting(true);
        setEditorError(null);
        setEditorSuccess(null);
        try {
            const res = await fetch(`/api/agents/${selectedId}`, { method: "DELETE" });
            const data = (await res.json()) as { ok?: boolean; error?: unknown };
            if (!res.ok || !data.ok) {
                setEditorError(
                    typeof data.error === "string" ? data.error : "Failed to delete agent."
                );
                return;
            }
            const remaining = agents.filter((a) => a.id !== selectedId);
            setAgents(remaining);
            if (activeAgentId === selectedId) setActiveAgentId(remaining[0]?.id ?? null);
            const next = remaining[0];
            if (next) {
                setSelectedId(next.id);
                setEditorForm(agentToForm(next));
            } else {
                setSelectedId(null);
                setIsNewAgent(false);
                setEditorForm(DEFAULT_FORM);
            }
            setEditorSuccess(null);
        } catch {
            setEditorError("Network error.");
        } finally {
            setDeleting(false);
        }
    };

    /* ── Render ── */
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Chatbot Settings</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Create and manage agents — each with its own persona, model, and tools.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void loadAgents()}
                    disabled={loading}
                    className="gap-2 self-start"
                >
                    {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <RotateCcw className="size-4" />
                    )}
                    Reload
                </Button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-muted-foreground">
                    <Loader2 className="size-8 animate-spin" />
                    <p className="text-sm">Loading agents…</p>
                </div>
            ) : (
                <>
                    {/* Two-column layout: sidebar + editor */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
                        {/* Left sidebar */}
                        <div className="rounded-xl border border-border bg-muted/30 p-4">
                            <AgentSidebar
                                agents={agents}
                                activeAgentId={activeAgentId}
                                selectedId={selectedId}
                                onSelect={handleSelectAgent}
                                onNew={handleNewAgent}
                                loading={loading}
                            />
                        </div>

                        {/* Right editor */}
                        <div>
                            {selectedId || isNewAgent ? (
                                <>
                                    <div className="mb-4 flex items-center gap-3">
                                        <SectionLabel>
                                            <Bot className="size-3.5" />
                                            {isNewAgent
                                                ? "New agent"
                                                : agents.find((a) => a.id === selectedId)?.name ?? "Edit agent"}
                                        </SectionLabel>
                                        {!isNewAgent && selectedId === activeAgentId && (
                                            <Badge
                                                variant="outline"
                                                className="h-5 border-primary/30 bg-primary/10 text-xs text-primary"
                                            >
                                                Active
                                            </Badge>
                                        )}
                                    </div>
                                    <AgentEditor
                                        key={selectedId ?? "new"}
                                        agent={editorForm}
                                        isActive={selectedId === activeAgentId}
                                        saving={saving}
                                        deleting={deleting}
                                        settingActive={settingActive}
                                        error={editorError}
                                        success={editorSuccess}
                                        onSave={(form) => void handleSave(form)}
                                        onSetActive={() => void handleSetActive()}
                                        onDelete={() => void handleDelete()}
                                        isNew={isNewAgent}
                                    />
                                </>
                            ) : (
                                <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-center text-muted-foreground">
                                    <Bot className="size-8 opacity-40" />
                                    <p className="text-sm">
                                        Select an agent to edit, or click{" "}
                                        <button
                                            type="button"
                                            onClick={handleNewAgent}
                                            className="font-medium text-foreground underline underline-offset-2"
                                        >
                                            New
                                        </button>{" "}
                                        to create one.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Global defaults fallback */}
                    <GlobalDefaultsCard />
                </>
            )}
        </div>
    );
}
