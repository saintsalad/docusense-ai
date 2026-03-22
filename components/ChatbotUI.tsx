"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef, useCallback, useMemo, memo, useLayoutEffect, createContext, useContext } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { isReasoningUIPart, isToolUIPart, type UIMessage } from "ai";
import { cn } from "@/lib/utils";
import {
    chatBubble,
    chatComposer,
    chatCopy,
    chatLayout,
    chatMessage,
    chatShell,
    chatSidebar,
    chatSystem,
    chatTyping,
} from "@/lib/chat-design";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion } from "framer-motion";
import {
    Send,
    Plus,
    MessageSquare,
    Database,
    Loader2,
    CheckCircle,
    Wrench,
    Pencil,
    Trash2,
    AlertTriangle,
    FilePlus,
    Bug,
    ChevronDown,
    Sparkles,
    Menu,
    X,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

/**
 * Prefix for synthetic user messages that report the outcome of a tool confirmation.
 * The AI sees this in history and acknowledges accordingly.
 */
const TOOL_OUTCOME_MARKER = "[TOOL_OUTCOME] ";

/** Truncate long document text so outcome messages stay concise for the model. */
function outcomeSnippet(text: string, max = 600): string {
    const t = text.trim();
    return t.length > max ? `${t.slice(0, max)}…` : t;
}

type ChatActionsContextValue = { onToolSettled: (msg: string) => void };
const ChatActionsContext = createContext<ChatActionsContextValue | null>(null);

const TOOL_FRIENDLY_NAME: Record<string, string> = {
    searchKnowledgeBase: "Knowledge base search",
    proposeAddKnowledgeDocument: "Propose KB document add (debug)",
    proposeUpdateKnowledgeDocument: "Propose KB document update (debug)",
    proposeDeleteKnowledgeDocument: "Propose KB document delete (debug)",
};

function toolUiMeta(rawName: string): { rawName: string; friendly: string } {
    return {
        rawName,
        friendly: TOOL_FRIENDLY_NAME[rawName] ?? rawName,
    };
}

/** Same message as MarkdownRenderer empty state — shown early while streaming / tools run. */
function AiTypingIndicator() {
    return (
        <div className={chatTyping.row}>
            <Loader2 className={chatTyping.icon} />
            <span className={chatTyping.text}>AI is typing…</span>
        </div>
    );
}

function textFromMessage(message: UIMessage): string {
    return message.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
}

/**
 * Many models (e.g. gpt-oss via Ollama) stream the visible answer in `reasoning` parts first.
 * Merge reasoning + text so the UI matches what users expect.
 */
function assistantMarkdownContent(message: UIMessage): string {
    const reasoning = message.parts
        .filter(isReasoningUIPart)
        .map((p) => p.text)
        .join("");

    const text = textFromMessage(message);

    const thinking =
        reasoning.trim().length > 0
            ? `\n\n` + `<think>${reasoning.trim()}` + `</think>\n\n`
            : "";

    return thinking + text;
}

function isToolPartAwaitingOutput(part: UIMessage["parts"][number]): boolean {
    if (!isToolUIPart(part)) return false;
    const s = part.state;
    return (
        s === "input-streaming" ||
        s === "input-available" ||
        s === "approval-requested" ||
        s === "approval-responded"
    );
}

function sidebarPreview(messages: UIMessage[]): string {
    const first = messages.find((m) => m.role === "user");
    if (!first) return chatCopy.newConversationPreview;
    const t = textFromMessage(first);
    if (!t) return chatCopy.newConversationPreview;
    const max = chatLayout.sidebarPreviewMaxChars;
    return t.length > max ? `${t.slice(0, max)}…` : t;
}

type VectorDebugPayload = {
    query: string;
    hitCount: number;
    hits: Array<{
        rank: number;
        id: string;
        distance: number;
        date: string;
        document: string;
    }>;
};

type KbSearchPublicOutput = {
    found: boolean;
    context: string;
};

function parseKbSearchPublicOutput(output: unknown): KbSearchPublicOutput | null {
    if (typeof output !== "object" || output === null) return null;
    const o = output as Record<string, unknown>;
    if (typeof o.found !== "boolean" || typeof o.context !== "string") return null;
    return { found: o.found, context: o.context };
}

function parseVectorDebugFromToolOutput(output: unknown): VectorDebugPayload | null {
    if (typeof output !== "object" || output === null) return null;
    const o = output as Record<string, unknown>;
    const vd = o.vectorDebug;
    if (typeof vd !== "object" || vd === null) return null;
    const v = vd as Record<string, unknown>;
    const hits = v.hits;
    if (!Array.isArray(hits)) return null;
    const normalized = hits.filter(
        (h): h is VectorDebugPayload["hits"][number] =>
            typeof h === "object" &&
            h !== null &&
            typeof (h as Record<string, unknown>).rank === "number" &&
            typeof (h as Record<string, unknown>).document === "string"
    );
    return {
        query: typeof v.query === "string" ? v.query : "",
        hitCount: typeof v.hitCount === "number" ? v.hitCount : normalized.length,
        hits: normalized.map((h, i) => ({
            rank: typeof h.rank === "number" ? h.rank : i + 1,
            id: typeof (h as { id?: unknown }).id === "string" ? (h as { id: string }).id : "",
            distance: typeof h.distance === "number" ? h.distance : Number.NaN,
            date: typeof h.date === "string" ? h.date : "unknown",
            document: h.document,
        })),
    };
}

type PendingKbUpdate = {
    pendingUserConfirmation: true;
    action: "update";
    recordId: string;
    currentDocument: string;
    proposedDocument: string;
    date: string;
    source?: string;
};

type PendingKbDelete = {
    pendingUserConfirmation: true;
    action: "delete";
    recordId: string;
    previewDocument: string;
    date: string;
    source?: string;
};

type PendingKbAdd = {
    pendingUserConfirmation: true;
    action: "add";
    proposedDocument: string;
    source?: string;
};

function parseProposeKbToolFailure(output: unknown): { error: string } | null {
    if (typeof output !== "object" || output === null) return null;
    const o = output as Record<string, unknown>;
    if (o.pendingUserConfirmation === true) return null;
    if (o.ok === false && typeof o.error === "string") return { error: o.error };
    return null;
}

function parsePendingKnowledgeMutation(output: unknown): PendingKbUpdate | PendingKbDelete | PendingKbAdd | null {
    if (typeof output !== "object" || output === null) return null;
    const o = output as Record<string, unknown>;
    if (o.pendingUserConfirmation !== true) return null;
    if (o.action === "add") {
        if (typeof o.proposedDocument === "string") {
            return {
                pendingUserConfirmation: true,
                action: "add",
                proposedDocument: o.proposedDocument,
                source: typeof o.source === "string" ? o.source : undefined,
            };
        }
    }
    if (o.action === "update") {
        if (
            typeof o.recordId === "string" &&
            typeof o.currentDocument === "string" &&
            typeof o.proposedDocument === "string" &&
            typeof o.date === "string"
        ) {
            return {
                pendingUserConfirmation: true,
                action: "update",
                recordId: o.recordId,
                currentDocument: o.currentDocument,
                proposedDocument: o.proposedDocument,
                date: o.date,
                source: typeof o.source === "string" ? o.source : undefined,
            };
        }
    }
    if (o.action === "delete") {
        if (
            typeof o.recordId === "string" &&
            typeof o.previewDocument === "string" &&
            typeof o.date === "string"
        ) {
            return {
                pendingUserConfirmation: true,
                action: "delete",
                recordId: o.recordId,
                previewDocument: o.previewDocument,
                date: o.date,
                source: typeof o.source === "string" ? o.source : undefined,
            };
        }
    }
    return null;
}

function DebugKnowledgeAddPanel({ payload }: { payload: PendingKbAdd }) {
    const chatActions = useContext(ChatActionsContext);
    const [edited, setEdited] = useState(payload.proposedDocument);
    const [sourceEdited, setSourceEdited] = useState(payload.source ?? "");
    const [loading, setLoading] = useState(false);
    const [phase, setPhase] = useState<"edit" | "ok" | "cancelled" | "err">("edit");
    const [errMsg, setErrMsg] = useState<string | null>(null);

    const onProceed = async () => {
        const text = edited.trim();
        if (!text) return;
        setLoading(true);
        setErrMsg(null);
        try {
            const body: { document: string; source?: string } = { document: text };
            const s = sourceEdited.trim();
            if (s) body.source = s;

            const res = await fetch("/api/knowledge/apply-add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = (await res.json()) as { ok?: boolean; recordId?: string; error?: unknown };
            if (!res.ok || !data.ok) {
                const msg =
                    typeof data.error === "string"
                        ? data.error
                        : "Add failed. Is DEBUG enabled on the server?";
                setErrMsg(msg);
                setPhase("err");
                return;
            }
            const rid = typeof data.recordId === "string" ? data.recordId : null;
            const wasEdited = text !== payload.proposedDocument.trim();
            setPhase("ok");
            chatActions?.onToolSettled(
                `${TOOL_OUTCOME_MARKER}proposeAddKnowledgeDocument: User confirmed.${wasEdited ? " (User edited the document before saving.)" : ""} Document added to knowledge base.${rid ? ` (id: ${rid})` : ""}\nSaved content:\n${outcomeSnippet(text)}`
            );
        } catch {
            setErrMsg("Network error");
            setPhase("err");
        } finally {
            setLoading(false);
        }
    };

    const onCancel = () => {
        setPhase("cancelled");
        chatActions?.onToolSettled(
            `${TOOL_OUTCOME_MARKER}proposeAddKnowledgeDocument: User cancelled. Document was NOT added to knowledge base.`
        );
    };

    if (phase === "ok" || phase === "cancelled") return null;

    return (
        <div className="mt-2 rounded-md border border-emerald-200/90 bg-emerald-50/70 p-3 text-left dark:border-emerald-900/55 dark:bg-emerald-950/25">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-emerald-950 dark:text-emerald-100">
                <FilePlus className="h-3.5 w-3.5 shrink-0" />
                DEBUG · Confirm new document
            </div>
            <p className="mb-2 text-[10px] text-emerald-900/85 dark:text-emerald-200/85">
                Edit the text below, then click <strong>Proceed</strong> to insert a new record in Chroma (embeds).
            </p>
            <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Source label (optional, metadata)</p>
                <Textarea
                    value={sourceEdited}
                    onChange={(e) => setSourceEdited(e.target.value)}
                    className="min-h-[44px] resize-y font-mono text-xs"
                    placeholder="e.g. meeting-notes (defaults to debug-add if empty)"
                    disabled={loading}
                    rows={2}
                />
            </div>
            <div className="mt-2 space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Document text (editable)</p>
                <Textarea
                    value={edited}
                    onChange={(e) => setEdited(e.target.value)}
                    className="min-h-[140px] resize-y font-mono text-xs"
                    disabled={loading}
                />
            </div>
            {errMsg ? <p className="mt-2 text-xs text-destructive">{errMsg}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancel
                </Button>
                <Button
                    type="button"
                    size="sm"
                    onClick={() => void onProceed()}
                    disabled={loading || !edited.trim()}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Adding…
                        </>
                    ) : (
                        "Proceed"
                    )}
                </Button>
            </div>
        </div>
    );
}

function DebugKnowledgeUpdatePanel({ payload }: { payload: PendingKbUpdate }) {
    const chatActions = useContext(ChatActionsContext);
    const [edited, setEdited] = useState(payload.proposedDocument);
    const [loading, setLoading] = useState(false);
    const [phase, setPhase] = useState<"edit" | "ok" | "cancelled" | "err">("edit");
    const [errMsg, setErrMsg] = useState<string | null>(null);

    const onProceed = async () => {
        const text = edited.trim();
        if (!text) return;
        setLoading(true);
        setErrMsg(null);
        try {
            const res = await fetch("/api/knowledge/apply-update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recordId: payload.recordId, document: text }),
            });
            const data = (await res.json()) as { ok?: boolean; error?: unknown };
            if (!res.ok || !data.ok) {
                const msg =
                    typeof data.error === "string"
                        ? data.error
                        : "Update failed. Is DEBUG enabled on the server?";
                setErrMsg(msg);
                setPhase("err");
                return;
            }
            const wasEdited = text !== payload.proposedDocument.trim();
            setPhase("ok");
            chatActions?.onToolSettled(
                `${TOOL_OUTCOME_MARKER}proposeUpdateKnowledgeDocument: User confirmed.${wasEdited ? " (User edited the proposed text before saving.)" : " (User accepted the proposed text as-is.)"} Record updated. (id: ${payload.recordId})\nSaved content:\n${outcomeSnippet(text)}`
            );
        } catch {
            setErrMsg("Network error");
            setPhase("err");
        } finally {
            setLoading(false);
        }
    };

    const onCancel = () => {
        setPhase("cancelled");
        chatActions?.onToolSettled(
            `${TOOL_OUTCOME_MARKER}proposeUpdateKnowledgeDocument: User cancelled. Record was NOT updated. (id: ${payload.recordId})`
        );
    };

    if (phase === "ok" || phase === "cancelled") return null;

    return (
        <div className="mt-2 rounded-md border border-amber-200/90 bg-amber-50/70 p-3 text-left dark:border-amber-900/55 dark:bg-amber-950/25">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-amber-950 dark:text-amber-100">
                <Pencil className="h-3.5 w-3.5 shrink-0" />
                DEBUG · Confirm document update
            </div>
            <p className="mb-2 text-[10px] text-amber-900/85 dark:text-amber-200/85">
                Edit the proposed text below, then click <strong>Proceed</strong> to write it to Chroma (re-embeds).
            </p>
            <div className="mb-2 space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">Current (read-only)</p>
                <pre className="max-h-28 overflow-y-auto rounded border border-amber-200/80 bg-white/90 p-2 text-[10px] whitespace-pre-wrap wrap-break-word dark:border-amber-900/40 dark:bg-gray-950/80">
                    {payload.currentDocument}
                </pre>
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground">New text (editable)</p>
                <Textarea
                    value={edited}
                    onChange={(e) => setEdited(e.target.value)}
                    className="min-h-[140px] resize-y font-mono text-xs"
                    disabled={loading}
                />
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span>date: {payload.date}</span>
                {payload.source ? <span>source: {payload.source}</span> : null}
            </div>
            {errMsg ? <p className="mt-2 text-xs text-destructive">{errMsg}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancel
                </Button>
                <Button
                    type="button"
                    size="sm"
                    onClick={() => void onProceed()}
                    disabled={loading || !edited.trim()}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Updating…
                        </>
                    ) : (
                        "Proceed"
                    )}
                </Button>
            </div>
        </div>
    );
}

function DebugKnowledgeDeletePanel({ payload }: { payload: PendingKbDelete }) {
    const chatActions = useContext(ChatActionsContext);
    const [loading, setLoading] = useState(false);
    const [phase, setPhase] = useState<"confirm" | "ok" | "cancelled" | "err">("confirm");
    const [errMsg, setErrMsg] = useState<string | null>(null);

    const onDelete = async () => {
        setLoading(true);
        setErrMsg(null);
        try {
            const res = await fetch("/api/knowledge/apply-delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recordId: payload.recordId }),
            });
            const data = (await res.json()) as { ok?: boolean; error?: unknown };
            if (!res.ok || !data.ok) {
                const msg =
                    typeof data.error === "string"
                        ? data.error
                        : "Delete failed. Is DEBUG enabled on the server?";
                setErrMsg(msg);
                setPhase("err");
                return;
            }
            setPhase("ok");
            chatActions?.onToolSettled(
                `${TOOL_OUTCOME_MARKER}proposeDeleteKnowledgeDocument: User confirmed deletion. Record permanently removed. (id: ${payload.recordId})\nDeleted content:\n${outcomeSnippet(payload.previewDocument)}`
            );
        } catch {
            setErrMsg("Network error");
            setPhase("err");
        } finally {
            setLoading(false);
        }
    };

    if (phase === "ok" || phase === "cancelled") return null;

    return (
        <div className="mt-2 rounded-md border border-red-200/90 bg-red-50/60 p-3 text-left dark:border-red-900/50 dark:bg-red-950/20">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-red-950 dark:text-red-100">
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                DEBUG · Confirm deletion
            </div>
            <div className="mb-2 flex gap-2 rounded border border-red-200/70 bg-white/90 p-2 dark:border-red-900/40 dark:bg-gray-950/80">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <p className="text-[10px] leading-snug text-red-900/90 dark:text-red-100/90">
                    This permanently deletes this chunk from the knowledge base. Confirm only if you intend to remove it.
                </p>
            </div>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">Record preview</p>
            <pre className="mb-2 max-h-32 overflow-y-auto rounded border border-red-200/60 bg-white/90 p-2 text-[10px] whitespace-pre-wrap wrap-break-word dark:border-red-900/35 dark:bg-gray-950/80">
                {payload.previewDocument}
            </pre>
            <div className="mb-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span>date: {payload.date}</span>
                {payload.source ? <span>source: {payload.source}</span> : null}
                <span className="font-mono break-all">id: {payload.recordId}</span>
            </div>
            {errMsg ? <p className="mb-2 text-xs text-destructive">{errMsg}</p> : null}
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setPhase("cancelled");
                        chatActions?.onToolSettled(
                            `${TOOL_OUTCOME_MARKER}proposeDeleteKnowledgeDocument: User cancelled deletion. Record was NOT deleted. (id: ${payload.recordId})`
                        );
                    }}
                    disabled={loading}
                >
                    Cancel
                </Button>
                <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void onDelete()}
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Deleting…
                        </>
                    ) : (
                        "Delete from vector DB"
                    )}
                </Button>
            </div>
        </div>
    );
}

/** Compact pill rendered in place of a regular user bubble for [TOOL_OUTCOME] messages. */
function ToolOutcomePill({ label }: { label: string }) {
    const cancelled = /cancell?ed/i.test(label);
    // First line only, strip tool prefix + all parentheticals (ids, edit notes, etc.)
    const display = label
        .split("\n")[0]
        .replace(/^[^:]+:\s*/, "")
        .replace(/\s*\([^)]*\)/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                cancelled
                    ? "border-border bg-muted/60 text-muted-foreground"
                    : "border-green-200/80 bg-green-50/80 text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200"
            )}
        >
            {cancelled ? (
                <X className="size-3 shrink-0" />
            ) : (
                <CheckCircle className="size-3 shrink-0 text-green-600 dark:text-green-400" />
            )}
            {display}
        </div>
    );
}

function KnowledgeBaseRetrievedSummary({ found, context }: KbSearchPublicOutput) {
    const previewMax = chatLayout.kbContextPreviewMaxChars;
    const text = context.length > previewMax ? `${context.slice(0, previewMax)}…` : context;
    return (
        <details className="mt-2 rounded-md border border-sky-200/90 bg-sky-50/60 text-left dark:border-sky-900/50 dark:bg-sky-950/25">
            <summary className="cursor-pointer select-none list-none px-2 py-2 text-[11px] font-semibold text-sky-950 dark:text-sky-100 [&::-webkit-details-marker]:hidden">
                {found ? "Retrieved from knowledge base" : "Knowledge base search (no matches)"}
            </summary>
            <div className="max-h-72 overflow-y-auto border-t border-sky-200/70 p-2 dark:border-sky-900/45">
                <pre className="whitespace-pre-wrap wrap-break-word text-[11px] text-gray-800 dark:text-gray-200">
                    {text}
                </pre>
            </div>
        </details>
    );
}

function KnowledgeBaseDebugAccordion({ debug }: { debug: VectorDebugPayload }) {
    return (
        <details className="mt-2 rounded-md border border-amber-200/90 bg-amber-50/60 text-left dark:border-amber-900/55 dark:bg-amber-950/25">
            <summary className="cursor-pointer select-none list-none px-2 py-2 text-[11px] font-semibold text-amber-950 dark:text-amber-100 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>DEBUG · Vector DB · {debug.hitCount} hit(s)</span>
                    <span className="font-normal opacity-90">
                        query:{" "}
                        <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono text-[10px] dark:bg-amber-900/40">
                            {debug.query || "—"}
                        </code>
                    </span>
                </span>
            </summary>
            <div className="max-h-72 space-y-2 overflow-y-auto border-t border-amber-200/70 p-2 dark:border-amber-900/45">
                <p className="text-[10px] text-amber-900/80 dark:text-amber-200/80">
                    Distance = Chroma space metric (lower usually means closer). Compare ranks, not raw values across
                    models.
                </p>
                {debug.hits.map((h) => (
                    <div
                        key={`${h.rank}-${h.date}-${h.document.slice(0, 20)}`}
                        className="rounded border border-gray-200 bg-white/95 p-2 text-[11px] dark:border-gray-700 dark:bg-gray-950/90"
                    >
                        <div className="mb-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-muted-foreground">
                            <span>rank #{h.rank}</span>
                            {h.id ? (
                                <span className="max-w-full break-all">
                                    id: <code className="text-[9px]">{h.id}</code>
                                </span>
                            ) : null}
                            <span>
                                score/distance:{" "}
                                {Number.isFinite(h.distance) ? h.distance.toFixed(6) : "n/a"}
                            </span>
                            <span>date: {h.date}</span>
                        </div>
                        <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap wrap-break-word text-gray-800 dark:text-gray-200">
                            {h.document}
                        </pre>
                    </div>
                ))}
            </div>
        </details>
    );
}

function ToolStatusRow({ part }: { part: UIMessage["parts"][number] }) {
    if (!isToolUIPart(part)) return null;
    const label =
        part.type === "dynamic-tool" ? part.toolName : part.type.replace(/^tool-/, "");
    const { rawName, friendly } = toolUiMeta(label);
    const isKb = label === "searchKnowledgeBase";
    const isProposeKb =
        label === "proposeAddKnowledgeDocument" ||
        label === "proposeUpdateKnowledgeDocument" ||
        label === "proposeDeleteKnowledgeDocument";
    const loading = isToolPartAwaitingOutput(part);
    const ToolIcon = isKb
        ? Database
        : label === "proposeDeleteKnowledgeDocument"
            ? Trash2
            : label === "proposeUpdateKnowledgeDocument"
                ? Pencil
                : label === "proposeAddKnowledgeDocument"
                    ? FilePlus
                    : Wrench;

    if (part.state === "output-available") {
        const vectorDebug = isKb ? parseVectorDebugFromToolOutput(part.output) : null;
        const kbPublic = isKb ? parseKbSearchPublicOutput(part.output) : null;
        const proposeFail = parseProposeKbToolFailure(part.output);
        const pendingMutation = parsePendingKnowledgeMutation(part.output);
        return (
            <div className="mt-2 space-y-0">
                <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs text-muted-foreground dark:border-gray-600 dark:bg-gray-900/50">
                    <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200">
                        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-500" />
                        <span>
                            Used tool{" "}
                            <code className="rounded bg-gray-200/80 px-1 py-0.5 font-mono text-[11px] dark:bg-gray-800">
                                {rawName}
                            </code>
                        </span>
                    </div>
                    <p className="mt-1 pl-5 text-[11px] leading-snug opacity-90">
                        {friendly}
                        {isKb ? " · Context retrieved" : pendingMutation ? " · Awaiting your confirmation" : " · Finished"}
                    </p>
                </div>
                {proposeFail ? (
                    <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        <span className="font-medium">Propose tool: </span>
                        {proposeFail.error}
                    </div>
                ) : null}
                {pendingMutation?.action === "add" ? (
                    <DebugKnowledgeAddPanel payload={pendingMutation} />
                ) : null}
                {pendingMutation?.action === "update" ? (
                    <DebugKnowledgeUpdatePanel payload={pendingMutation} />
                ) : null}
                {pendingMutation?.action === "delete" ? (
                    <DebugKnowledgeDeletePanel payload={pendingMutation} />
                ) : null}
                {vectorDebug && vectorDebug.hits.length > 0 ? (
                    <KnowledgeBaseDebugAccordion debug={vectorDebug} />
                ) : kbPublic ? (
                    <KnowledgeBaseRetrievedSummary found={kbPublic.found} context={kbPublic.context} />
                ) : null}
            </div>
        );
    }
    if (part.state === "output-error") {
        return (
            <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
                <span className="font-medium text-destructive">Tool failed: </span>
                <code className="rounded bg-destructive/10 px-1 py-0.5 font-mono text-[11px]">{rawName}</code>
                {part.errorText ? (
                    <p className="mt-1 text-destructive/90">{part.errorText}</p>
                ) : null}
            </div>
        );
    }
    return (
        <div
            className={cn(
                "mt-2 rounded-lg border border-blue-200/80 bg-blue-50/90 px-3 py-2.5 text-sm text-blue-900 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-100"
            )}
            role="status"
            aria-live="polite"
            aria-busy={loading}
        >
            <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
                <ToolIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                <div className="min-w-0 flex-1">
                    <div className="font-medium leading-tight">
                        Running tool{" "}
                        <code className="rounded bg-blue-100/90 px-1 py-0.5 font-mono text-[11px] text-blue-900 dark:bg-blue-900/50 dark:text-blue-100">
                            {rawName}
                        </code>
                    </div>
                    <p className="mt-0.5 text-xs text-blue-800/90 dark:text-blue-200/90">
                        {isKb
                            ? "Searching your knowledge base…"
                            : isProposeKb
                                ? "Preparing debug KB action…"
                                : `${friendly}…`}
                    </p>
                </div>
            </div>
        </div>
    );
}

const AssistantBubble = memo(function AssistantBubble({
    message,
    isActiveAssistant,
}: {
    message: UIMessage;
    isActiveAssistant: boolean;
}) {
    const markdown = assistantMarkdownContent(message);
    const toolParts = message.parts.filter(isToolUIPart);
    const hasBody = markdown.trim().length > 0;
    const toolLoading = toolParts.some(isToolPartAwaitingOutput);
    /** Show typing as soon as this assistant turn is in flight, even before first token or while tools run. */
    const showTyping = !hasBody && (isActiveAssistant || toolLoading);

    return (
        <div className="w-full space-y-3">
            {showTyping ? <AiTypingIndicator /> : null}
            {hasBody ? (
                <MarkdownRenderer content={markdown} showThinking={true} />
            ) : null}
            {toolParts.map((part, i) => (
                <ToolStatusRow key={`${message.id}-t-${i}`} part={part} />
            ))}
        </div>
    );
});

const ChatMessageRow = memo(
    function ChatMessageRow({
        msg,
        isActiveAssistant,
        motionInitial,
        aiName,
    }: {
        msg: UIMessage;
        isActiveAssistant: boolean;
        motionInitial: boolean;
        aiName: string;
    }) {
        const isUser = msg.role === "user";

        // Tool outcome messages are rendered as compact centered pills, not full bubbles.
        if (isUser) {
            const text = textFromMessage(msg);
            if (text.startsWith(TOOL_OUTCOME_MARKER)) {
                return (
                    <div className="mb-4 flex justify-center">
                        <ToolOutcomePill label={text.slice(TOOL_OUTCOME_MARKER.length)} />
                    </div>
                );
            }
        }

        const metaRow = (
            <div className={isUser ? chatMessage.metaUser : chatMessage.metaAssistant}>
                <span className={chatMessage.metaName}>
                    {isUser ? chatCopy.roleUser : aiName}
                </span>
            </div>
        );

        const bubble = (
            <motion.div
                initial={motionInitial ? { opacity: 0, y: 6 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={cn(chatBubble.base, isUser ? chatBubble.user : chatBubble.assistant)}
            >
                {msg.role === "assistant" ? (
                    <AssistantBubble message={msg} isActiveAssistant={isActiveAssistant} />
                ) : (
                    <span className={chatBubble.userText}>{textFromMessage(msg)}</span>
                )}
            </motion.div>
        );

        const avatar = isUser ? null : (
            <div
                className={cn(chatMessage.avatarBase, chatMessage.avatarAssistant)}
                aria-hidden
            >
                <Sparkles className="size-[15px]" strokeWidth={2} />
            </div>
        );

        return (
            <div className={isUser ? chatMessage.outerUser : chatMessage.outerAssistant}>
                {metaRow}
                <div className={isUser ? chatMessage.bubbleRowUser : chatMessage.bubbleRowAssistant}>
                    {avatar}
                    {bubble}
                </div>
            </div>
        );
    },
    (prev, next) =>
        prev.msg === next.msg &&
        prev.isActiveAssistant === next.isActiveAssistant &&
        prev.motionInitial === next.motionInitial &&
        prev.aiName === next.aiName
);

type DebugChatContext = {
    aiName: string;
    aiPersonality: string;
    assistantMode: boolean;
};

function DebugChatIdentityBanner({ ctx }: { ctx: DebugChatContext }) {
    const hasPersona = ctx.aiPersonality.trim().length > 0;
    return (
        <div className={chatSystem.debugWrap}>
            <Collapsible defaultOpen={false} className="group/collapse">
                <CollapsibleTrigger className={chatSystem.debugTrigger}>
                    <Bug className="size-3.5 shrink-0 opacity-70" />
                    <span className="truncate">Debug · model identity</span>
                    <Badge variant="outline" className="ml-1 shrink-0 text-[10px] font-normal">
                        server
                    </Badge>
                    <ChevronDown className="ml-auto size-4 shrink-0 opacity-60 transition-transform duration-200 group-data-[state=open]/collapse:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className={chatSystem.debugContent}>
                    <Card className={chatSystem.debugCard}>
                        <CardHeader className={chatSystem.debugCardHeader}>
                            <CardTitle className={chatSystem.debugCardTitle}>Assistant identity</CardTitle>
                            <CardDescription className="text-[11px]">
                                From debug-context when DEBUG is enabled.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 border-t border-border px-3 py-2.5 text-xs text-card-foreground">
                            <div>
                                <span className={chatSystem.debugLabel}>Name · </span>
                                <span className={chatSystem.debugMono}>{ctx.aiName}</span>
                            </div>
                            <div>
                                <span className={chatSystem.debugLabel}>Assistant mode · </span>
                                <span className={chatSystem.debugMono}>
                                    {ctx.assistantMode ? "on" : "off"}
                                </span>
                            </div>
                            <div>
                                <span className={chatSystem.debugLabel}>Personality</span>
                                {hasPersona ? (
                                    <pre className={chatSystem.debugPre}>{ctx.aiPersonality}</pre>
                                ) : (
                                    <p className="mt-1 text-muted-foreground italic">Not set</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

const INITIAL_CONV_ID = "conv-1";

function EmptyChatState({ aiName }: { aiName: string }) {
    return (
        <div className={chatSystem.emptyWrap}>
            <div className={chatSystem.emptyIconWrap}>
                <Sparkles className="size-7" strokeWidth={1.5} />
            </div>
            <div>
                <p className={chatSystem.emptyTitle}>{aiName}</p>
                <p className={chatSystem.emptySubtitle}>{chatCopy.emptySubtitle}</p>
            </div>
        </div>
    );
}

export default function ChatbotUI() {
    const [convIds, setConvIds] = useState<string[]>([INITIAL_CONV_ID]);
    const [convStore, setConvStore] = useState<Record<string, UIMessage[]>>({
        [INITIAL_CONV_ID]: [],
    });
    const [activeConv, setActiveConv] = useState(INITIAL_CONV_ID);
    const [input, setInput] = useState("");
    const [chatError, setChatError] = useState<string | null>(null);
    const [debugIdentity, setDebugIdentity] = useState<DebugChatContext | null>(null);
    const [aiDisplayName, setAiDisplayName] = useState<string>(chatCopy.defaultAiName);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const scrollParentRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const stickToBottomRef = useRef(true);
    const persistConvIdRef = useRef(activeConv);
    persistConvIdRef.current = activeConv;

    const { messages: rawMessages, sendMessage, status, clearError } = useChat({
        id: activeConv,
        messages: convStore[activeConv] ?? [],
        onFinish: ({ messages: next, isError }) => {
            const id = persistConvIdRef.current;
            setConvStore((prev) => ({ ...prev, [id]: next }));
            if (!isError) setChatError(null);
        },
        onError: (err) => {
            console.error("Chat error:", err);
            setChatError(err.message || "Something went wrong");
            queueMicrotask(() => {
                clearError();
            });
        },
    });

    /**
     * Deduplicate by message ID. The AI SDK can produce duplicate entries when
     * sendMessage fires a new turn while controlled `messages` (from convStore)
     * and the SDK's internal state both carry the same message after onFinish.
     */
    const messages = useMemo(() => {
        const seen = new Set<string>();
        return rawMessages.filter((msg) => {
            if (seen.has(msg.id)) return false;
            seen.add(msg.id);
            return true;
        });
    }, [rawMessages]);

    /** Only block duplicate sends while a request is in progress — not when status is `error` (that would freeze the UI). */
    const chatInFlight = status === "submitted" || status === "streaming";

    const activeAssistantId = useMemo(() => {
        if (status !== "streaming" && status !== "submitted") return null;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "assistant") return messages[i].id;
        }
        return null;
    }, [messages, status]);

    const useVirtualList = messages.length >= chatLayout.virtualThreshold;

    const virtualizer = useVirtualizer({
        count: messages.length,
        getScrollElement: () => scrollParentRef.current,
        estimateSize: () => chatLayout.virtualEstimateRowPx,
        overscan: chatLayout.virtualOverscan,
        gap: chatLayout.virtualGapPx,
        paddingStart: chatLayout.virtualPaddingStartPx,
        paddingEnd: chatLayout.virtualPaddingEndPx,
        getItemKey: (index) => messages[index]?.id ?? index,
        enabled: useVirtualList,
        useAnimationFrameWithResizeObserver: true,
    });

    const onScrollParent = useCallback(() => {
        const el = scrollParentRef.current;
        if (!el) return;
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
        stickToBottomRef.current = dist < chatLayout.stickToBottomPx;
    }, []);

    useLayoutEffect(() => {
        if (messages.length === 0) return;
        if (!stickToBottomRef.current) return;
        const id = requestAnimationFrame(() => {
            if (useVirtualList) {
                virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "auto" });
            } else {
                const behavior: ScrollBehavior =
                    status === "streaming" || status === "submitted" ? "auto" : "smooth";
                messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
            }
        });
        return () => cancelAnimationFrame(id);
    }, [messages, activeConv, useVirtualList, virtualizer, messages.length, status]);

    const loadConfig = useCallback(async () => {
        try {
            const res = await fetch("/api/chatbot-config", { cache: "no-store" });
            const data = (await res.json()) as {
                ok?: boolean;
                config?: { aiName?: string };
            };
            if (data.ok && typeof data.config?.aiName === "string" && data.config.aiName.trim()) {
                setAiDisplayName(data.config.aiName.trim());
            }
        } catch { /* silently keep default */ }
    }, []);

    const loadDebugIdentity = useCallback(async () => {
        try {
            const res = await fetch(`/api/chat/debug-context?t=${Date.now()}`, { cache: "no-store" });
            const data = (await res.json()) as {
                debug?: boolean;
                aiName?: string;
                aiPersonality?: string;
                assistantMode?: boolean;
            };
            if (data.debug === true && typeof data.aiName === "string") {
                setDebugIdentity({
                    aiName: data.aiName,
                    aiPersonality: typeof data.aiPersonality === "string" ? data.aiPersonality : "",
                    assistantMode: typeof data.assistantMode === "boolean" ? data.assistantMode : true,
                });
            } else {
                setDebugIdentity(null);
            }
        } catch {
            setDebugIdentity(null);
        }
    }, []);

    useEffect(() => {
        void loadConfig();
        void loadDebugIdentity();
    }, [loadConfig, loadDebugIdentity]);

    useEffect(() => {
        const onFocus = () => {
            void loadDebugIdentity();
        };
        const onVis = () => {
            if (document.visibilityState === "visible") void loadDebugIdentity();
        };
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVis);
        return () => {
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [loadDebugIdentity]);

    const createNewConversation = useCallback(() => {
        if (chatInFlight) return;
        stickToBottomRef.current = true;
        const id = `conv-${Date.now()}`;
        setConvIds((prev) => [id, ...prev]);
        setConvStore((prev) => ({ ...prev, [id]: [] }));
        setActiveConv(id);
    }, [chatInFlight]);

    const switchConversation = useCallback(
        (id: string) => {
            if (chatInFlight) return;
            stickToBottomRef.current = true;
            setActiveConv(id);
        },
        [chatInFlight]
    );

    const handleSend = async () => {
        const text = input.trim();
        if (!text || chatInFlight) return;
        setInput("");
        setChatError(null);
        stickToBottomRef.current = true;
        persistConvIdRef.current = activeConv;
        await sendMessage({ text });
    };

    const onToolSettled = useCallback((msg: string) => {
        stickToBottomRef.current = true;
        void sendMessage({ text: msg });
    }, [sendMessage]);

    return (
        <ChatActionsContext.Provider value={{ onToolSettled }}>
        <div className={chatShell.root}>
            {/* ── Mobile sidebar backdrop ── */}
            {mobileSidebarOpen && (
                <div
                    className={chatSidebar.backdrop}
                    onClick={() => setMobileSidebarOpen(false)}
                    aria-hidden
                />
            )}

            {/* ── Sidebar ── */}
            <aside
                className={cn(
                    chatSidebar.aside,
                    mobileSidebarOpen ? chatSidebar.asideOpen : chatSidebar.asideClosed
                )}
            >
                <div className={chatSidebar.header}>
                    <div className={chatSidebar.headerLeft}>
                        <MessageSquare className={chatSidebar.titleIcon} aria-hidden />
                        <h2 className={chatSidebar.title}>{chatCopy.sidebarHeading}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={() => setMobileSidebarOpen(false)}
                        className={chatSidebar.closeBtn}
                        aria-label="Close sidebar"
                    >
                        <X className="size-4" />
                    </button>
                    <button
                        type="button"
                        onClick={createNewConversation}
                        disabled={chatInFlight}
                        className={chatSidebar.newChatBtn}
                        aria-label={chatCopy.newChatAria}
                    >
                        <Plus className="size-4" />
                    </button>
                </div>
                <ScrollArea className={chatSidebar.scrollArea}>
                    <div className={chatSidebar.list}>
                        {convIds.map((convId) => {
                            const list = convId === activeConv ? messages : (convStore[convId] ?? []);
                            const count = list.length;
                            const isActive = activeConv === convId;
                            return (
                                <button
                                    key={convId}
                                    type="button"
                                    onClick={() => { switchConversation(convId); setMobileSidebarOpen(false); }}
                                    disabled={chatInFlight}
                                    className={cn(
                                        chatSidebar.convBtn,
                                        isActive ? chatSidebar.convBtnActive : chatSidebar.convBtnInactive,
                                        chatInFlight && !isActive && "pointer-events-none opacity-40"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            chatSidebar.convIconWrap,
                                            isActive
                                                ? chatSidebar.convIconWrapActive
                                                : chatSidebar.convIconWrapInactive
                                        )}
                                        aria-hidden
                                    >
                                        <MessageSquare className="size-[15px]" strokeWidth={1.75} />
                                    </div>
                                    <div className={chatSidebar.convBody}>
                                        <p className={chatSidebar.convTitle}>
                                            {sidebarPreview(list)}
                                        </p>
                                        <p className={chatSidebar.convMeta}>
                                            {count > 0 ? (
                                                <>
                                                    <span className={chatSidebar.convMetaDot} aria-hidden />
                                                    {count} {count === 1 ? "message" : "messages"}
                                                </>
                                            ) : (
                                                "No messages yet"
                                            )}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </ScrollArea>
            </aside>

            {/* ── Chat area ── */}
            <div className={chatShell.chatRegion}>
                {/* Mobile top bar */}
                <div className={chatShell.mobileHeader}>
                    <button
                        type="button"
                        onClick={() => setMobileSidebarOpen(true)}
                        className={chatShell.mobileMenuBtn}
                        aria-label="Open sidebar"
                    >
                        <Menu className="size-5" />
                    </button>
                    <span className={chatShell.mobileTitleText}>
                        {sidebarPreview(messages)}
                    </span>
                    <button
                        type="button"
                        onClick={createNewConversation}
                        disabled={chatInFlight}
                        className={chatShell.mobileNewChatBtn}
                        aria-label={chatCopy.newChatAria}
                    >
                        <Plus className="size-5" />
                    </button>
                </div>

                {debugIdentity ? <DebugChatIdentityBanner ctx={debugIdentity} /> : null}
                {chatError ? (
                    <div className={chatSystem.errorCard} role="alert">
                        {chatError}
                    </div>
                ) : null}
                <div
                    ref={scrollParentRef}
                    onScroll={onScrollParent}
                    className={chatShell.messagesScroll}
                >
                    {messages.length === 0 ? (
                        <div className={chatShell.messagesInner}>
                            <EmptyChatState aiName={aiDisplayName} />
                        </div>
                    ) : useVirtualList ? (
                        <div
                            className="relative mx-auto w-full max-w-2xl px-5 pt-6"
                            style={{ height: virtualizer.getTotalSize() }}
                        >
                            {virtualizer.getVirtualItems().map((virtualRow) => {
                                const msg = messages[virtualRow.index];
                                if (!msg) return null;
                                return (
                                    <div
                                        key={virtualRow.key}
                                        data-index={virtualRow.index}
                                        ref={virtualizer.measureElement}
                                        className="absolute left-0 top-0 w-full"
                                        style={{ transform: `translateY(${virtualRow.start}px)` }}
                                    >
                                        <ChatMessageRow
                                            msg={msg}
                                            isActiveAssistant={msg.id === activeAssistantId}
                                            motionInitial={false}
                                            aiName={aiDisplayName}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className={chatShell.messagesInner}>
                            {messages.map((msg) => (
                                <ChatMessageRow
                                    key={msg.id}
                                    msg={msg}
                                    isActiveAssistant={msg.id === activeAssistantId}
                                    motionInitial={true}
                                    aiName={aiDisplayName}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* ── Composer ── */}
                <div className={chatComposer.bar}>
                    <div className={chatComposer.inner}>
                        <Textarea
                            value={input}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                setInput(e.target.value)
                            }
                            placeholder={chatCopy.inputPlaceholder}
                            className={chatComposer.textarea}
                            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    void handleSend();
                                }
                            }}
                            rows={1}
                        />
                        <button
                            type="button"
                            onClick={() => void handleSend()}
                            disabled={!input.trim() || chatInFlight}
                            className={chatComposer.sendBtn}
                            aria-label="Send"
                        >
                            <Send className="size-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
        </ChatActionsContext.Provider>
    );
}
