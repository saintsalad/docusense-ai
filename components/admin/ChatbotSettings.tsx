"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Brain, Zap, Save, RotateCcw, Loader2, AlertCircle, CheckCircle } from "lucide-react";

type FormConfig = {
    aiName: string;
    aiPersonality: string;
    ollamaChatModel: string;
    chatTemperature: number;
    knowledgeSearchNResults: number;
};

const defaultForm: FormConfig = {
    aiName: "Assistant",
    aiPersonality: "",
    ollamaChatModel: "gpt-oss:20b",
    chatTemperature: 0,
    knowledgeSearchNResults: 12,
};

export default function ChatbotSettings() {
    const [form, setForm] = useState<FormConfig>(defaultForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedOk, setSavedOk] = useState(false);

    const loadConfig = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSavedOk(false);
        try {
            const res = await fetch("/api/chatbot-config", { cache: "no-store" });
            const data = (await res.json()) as {
                ok?: boolean;
                config?: FormConfig;
                error?: unknown;
            };
            if (!res.ok || !data.ok || !data.config) {
                const msg =
                    typeof data.error === "string" ? data.error : "Failed to load settings";
                setError(msg);
                return;
            }
            setForm(data.config);
        } catch {
            setError("Network error loading settings");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadConfig();
    }, [loadConfig]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSavedOk(false);
        try {
            const res = await fetch("/api/chatbot-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    aiName: form.aiName,
                    aiPersonality: form.aiPersonality,
                    ollamaChatModel: form.ollamaChatModel.trim(),
                    chatTemperature: form.chatTemperature,
                    knowledgeSearchNResults: form.knowledgeSearchNResults,
                }),
            });
            const data = (await res.json()) as {
                ok?: boolean;
                config?: FormConfig;
                error?: unknown;
            };
            if (!res.ok || !data.ok) {
                const msg =
                    typeof data.error === "string"
                        ? data.error
                        : data.error !== undefined
                          ? JSON.stringify(data.error)
                          : "Save failed — check fields (name ≤80 chars, personality ≤8000).";
                setError(msg);
                return;
            }
            if (data.config) setForm(data.config);
            setSavedOk(true);
        } catch {
            setError("Network error while saving");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Chatbot Settings</h2>
                    <p className="text-muted-foreground mt-1">
                        Saved to <code className="text-xs">data/chatbot-config.json</code> (no server restart
                        needed for name, persona, model, temperature, or KB result count)
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        onClick={() => void loadConfig()}
                        disabled={loading || saving}
                        className="gap-2"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        Reload
                    </Button>
                    <Button onClick={() => void handleSave()} disabled={loading || saving} className="gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save changes
                    </Button>
                </div>
            </div>

            {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            ) : null}

            {savedOk ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-100">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    Settings saved.
                </div>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Identity &amp; persona
                    </CardTitle>
                    <CardDescription>
                        Shown in the chat system prompt. <code className="text-xs">AI_NAME</code> /{" "}
                        <code className="text-xs">AI_PERSONALITY</code> in <code className="text-xs">.env</code> apply
                        only when a field is not stored in the JSON file.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="aiName" className="text-sm font-medium">
                            Assistant name
                        </label>
                        <Input
                            id="aiName"
                            value={form.aiName}
                            onChange={(e) => setForm((f) => ({ ...f, aiName: e.target.value }))}
                            placeholder="Assistant"
                            maxLength={80}
                            disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">Max 80 characters.</p>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="aiPersonality" className="text-sm font-medium">
                            Personality / style
                        </label>
                        <Textarea
                            id="aiPersonality"
                            value={form.aiPersonality}
                            onChange={(e) => setForm((f) => ({ ...f, aiPersonality: e.target.value }))}
                            rows={8}
                            className="resize-y font-mono text-sm min-h-[160px]"
                            placeholder="Tone, role, formatting preferences…"
                            maxLength={8000}
                            disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">
                            {form.aiPersonality.length} / 8000 — leave empty for no extra persona (env fallback if
                            set).
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5" />
                        Model
                    </CardTitle>
                    <CardDescription>Ollama chat model id (OpenAI-compatible API at your Ollama host)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="ollamaChatModel" className="text-sm font-medium">
                            Model id
                        </label>
                        <Input
                            id="ollamaChatModel"
                            value={form.ollamaChatModel}
                            onChange={(e) => setForm((f) => ({ ...f, ollamaChatModel: e.target.value }))}
                            placeholder="gpt-oss:20b"
                            disabled={loading}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="chatTemperature" className="text-sm font-medium">
                            Temperature
                        </label>
                        <Input
                            id="chatTemperature"
                            type="number"
                            step="0.1"
                            min={0}
                            max={2}
                            value={form.chatTemperature}
                            onChange={(e) => {
                                const n = Number.parseFloat(e.target.value);
                                setForm((f) => ({
                                    ...f,
                                    chatTemperature: Number.isFinite(n) ? Math.min(2, Math.max(0, n)) : 0,
                                }));
                            }}
                            disabled={loading}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Knowledge base retrieval
                    </CardTitle>
                    <CardDescription>
                        Number of chunks retrieved for <code className="text-xs">searchKnowledgeBase</code> (vector
                        query)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="knowledgeSearchNResults" className="text-sm font-medium">
                            Chunks (top K)
                        </label>
                        <Input
                            id="knowledgeSearchNResults"
                            type="number"
                            min={1}
                            max={50}
                            value={form.knowledgeSearchNResults}
                            onChange={(e) => {
                                const n = Number.parseInt(e.target.value, 10);
                                setForm((f) => ({
                                    ...f,
                                    knowledgeSearchNResults: Number.isFinite(n)
                                        ? Math.min(50, Math.max(1, n))
                                        : 12,
                                }));
                            }}
                            disabled={loading}
                        />
                    </div>
                    <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="mr-2">
                            Note
                        </Badge>
                        Overrides <code className="text-[10px]">KNOWLEDGE_SEARCH_N_RESULTS</code> when saved here.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
