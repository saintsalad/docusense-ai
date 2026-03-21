"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { isReasoningUIPart, isToolUIPart, type UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Send, Plus, MessageSquare, Database, Loader2, CheckCircle, Wrench } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

const TOOL_FRIENDLY_NAME: Record<string, string> = {
    searchKnowledgeBase: "Knowledge base search",
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
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 min-h-[22px]">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span className="text-sm">AI is typing...</span>
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
    if (!first) return "New Conversation";
    const t = textFromMessage(first);
    if (!t) return "New Conversation";
    return t.length > 30 ? `${t.slice(0, 30)}…` : t;
}

type VectorDebugPayload = {
    query: string;
    hitCount: number;
    hits: Array<{
        rank: number;
        distance: number;
        date: string;
        document: string;
    }>;
};

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
            distance: typeof h.distance === "number" ? h.distance : Number.NaN,
            date: typeof h.date === "string" ? h.date : "unknown",
            document: h.document,
        })),
    };
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
                            <span>
                                score/distance:{" "}
                                {Number.isFinite(h.distance) ? h.distance.toFixed(6) : "n/a"}
                            </span>
                            <span>date: {h.date}</span>
                        </div>
                        <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
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
    const loading = isToolPartAwaitingOutput(part);
    const ToolIcon = isKb ? Database : Wrench;

    if (part.state === "output-available") {
        const vectorDebug = isKb ? parseVectorDebugFromToolOutput(part.output) : null;
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
                        {isKb ? " · Context retrieved" : " · Finished"}
                    </p>
                </div>
                {vectorDebug && vectorDebug.hits.length > 0 ? (
                    <KnowledgeBaseDebugAccordion debug={vectorDebug} />
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
                        {isKb ? "Searching your knowledge base…" : `${friendly}…`}
                    </p>
                </div>
            </div>
        </div>
    );
}

function AssistantBubble({
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
}

const welcomeMessages: UIMessage[] = [
    {
        id: "seed-u",
        role: "user",
        parts: [{ type: "text", text: "Hello AI 👋" }],
    },
    {
        id: "seed-a",
        role: "assistant",
        parts: [{ type: "text", text: "Hey there! How can I help you today?" }],
    },
];

export default function ChatbotUI() {
    const [convIds, setConvIds] = useState<string[]>(["conv-1", "conv-2"]);
    const [convStore, setConvStore] = useState<Record<string, UIMessage[]>>({
        "conv-1": welcomeMessages,
        "conv-2": [],
    });
    const [activeConv, setActiveConv] = useState("conv-1");
    const [input, setInput] = useState("");
    const [chatError, setChatError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const persistConvIdRef = useRef(activeConv);
    persistConvIdRef.current = activeConv;

    const { messages, sendMessage, status } = useChat({
        id: activeConv,
        messages: convStore[activeConv] ?? [],
        onFinish: ({ messages: next }) => {
            const id = persistConvIdRef.current;
            setConvStore((prev) => ({ ...prev, [id]: next }));
            setChatError(null);
        },
        onError: (err) => {
            console.error("Chat error:", err);
            setChatError(err.message || "Something went wrong");
        },
    });

    const busy = status !== "ready";

    const activeAssistantId = useMemo(() => {
        if (status !== "streaming" && status !== "submitted") return null;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "assistant") return messages[i].id;
        }
        return null;
    }, [messages, status]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, activeConv, status, activeAssistantId]);

    const createNewConversation = useCallback(() => {
        if (busy) return;
        const id = `conv-${Date.now()}`;
        setConvIds((prev) => [id, ...prev]);
        setConvStore((prev) => ({ ...prev, [id]: [] }));
        setActiveConv(id);
    }, [busy]);

    const switchConversation = useCallback(
        (id: string) => {
            if (busy) return;
            setActiveConv(id);
        },
        [busy]
    );

    const handleSend = async () => {
        const text = input.trim();
        if (!text || busy) return;
        setInput("");
        setChatError(null);
        persistConvIdRef.current = activeConv;
        await sendMessage({ text });
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-950 overflow-hidden">
            {/* Sidebar */}
            <div className="w-72 border-r border-gray-200 dark:border-gray-800 backdrop-blur-lg p-4 flex flex-col bg-white/50 dark:bg-gray-900/50">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                        <MessageSquare className="h-5 w-5 text-blue-500" />
                        Conversations
                    </h2>
                    <Button
                        size="sm"
                        onClick={createNewConversation}
                        disabled={busy}
                        className="rounded-full h-8 w-8 p-0 bg-blue-500 hover:bg-blue-600 shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <ScrollArea className="flex-1 min-h-0 -mx-2">
                    <div className="space-y-2 px-2">
                        {convIds.map((convId) => {
                            const list = convId === activeConv ? messages : (convStore[convId] ?? []);
                            const count = list.length;
                            return (
                                <button
                                    key={convId}
                                    type="button"
                                    onClick={() => switchConversation(convId)}
                                    disabled={busy}
                                    className={cn(
                                        "w-full rounded-lg px-4 py-3 text-left transition-colors duration-200",
                                        busy && convId !== activeConv && "opacity-50 cursor-not-allowed",
                                        activeConv === convId
                                            ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                                            : "bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                                    )}
                                >
                                    <div className="flex flex-col items-start w-full">
                                        <div className="flex items-center justify-between w-full mb-2">
                                            <span className="font-medium text-sm truncate flex-1 text-gray-800 dark:text-gray-100">
                                                {sidebarPreview(list)}
                                            </span>
                                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                                {count}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-xs text-gray-500">
                                                {count > 0 ? "Active" : "Empty"}
                                            </span>
                                            <div
                                                className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    activeConv === convId
                                                        ? "bg-blue-500"
                                                        : "bg-gray-400 dark:bg-gray-500"
                                                )}
                                            />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col min-h-0">
                {chatError ? (
                    <div className="shrink-0 mx-4 mt-4 max-w-3xl md:mx-auto w-[calc(100%-2rem)] rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                        {chatError}
                    </div>
                ) : null}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="p-6 space-y-7 pb-10 max-w-3xl mx-auto">
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className={cn(
                                        "rounded-3xl px-4 py-3 shadow-sm backdrop-blur-sm",
                                        msg.role === "user"
                                            ? "ml-auto bg-blue-500 text-white max-w-xl w-fit"
                                            : "w-fit bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 max-w-2xl"
                                    )}
                                >
                                    {msg.role === "assistant" ? (
                                        <AssistantBubble
                                            message={msg}
                                            isActiveAssistant={msg.id === activeAssistantId}
                                        />
                                    ) : (
                                        <span className="whitespace-pre-wrap break-words">
                                            {textFromMessage(msg)}
                                        </span>
                                    )}
                                </motion.div>
                            ))}
                            <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className="sticky bottom-0 bg-gradient-to-t from-gray-100/95 to-transparent dark:from-gray-900/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex items-center gap-3 max-w-3xl mx-auto">
                        <Textarea
                            value={input}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                setInput(e.target.value)
                            }
                            placeholder="Type your message... (Shift+Enter for new line)"
                            className="flex-1 rounded-2xl px-4 py-3 text-base shadow-lg border-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md focus:ring-2 focus:ring-blue-500/20 resize-none min-h-[48px]"
                            disabled={busy}
                            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    void handleSend();
                                }
                            }}
                            rows={1}
                        />
                        <Button
                            size="icon"
                            onClick={() => void handleSend()}
                            disabled={!input.trim() || busy}
                            className="rounded-full shadow-lg h-12 w-12 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
