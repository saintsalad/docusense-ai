import {
    streamText,
    tool,
    stepCountIs,
    convertToModelMessages,
    type UIMessage,
} from "ai";
import { z } from "zod";
import { chatModel } from "@/lib/chat-model";
import { fetchKnowledgeBase } from "@/lib/knowledge-context";
import { isServerDebugEnabled, parseChatMaxOutputTokens } from "@/lib/env-server";

/** Required for streaming UI message chunks; avoids buffering that breaks the client parser. */
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a helpful expert AI assistant for software development and general questions.

You can call the tool "searchKnowledgeBase" to retrieve passages from the user's **private knowledge base** (documents they uploaded).

When to use the tool:
- The user asks about their own notes, docs, project specifics, or anything that might only exist in their knowledge base.
- They explicitly ask you to look something up or search their documents.

When **not** to use the tool:
- General programming, APIs, algorithms, or technology questions answerable without their private docs.
- Small talk, greetings, or meta questions about the chat.

If the tool returns no useful results, say so briefly and answer from general knowledge when possible.

**Using retrieved context (important):**
- The tool may return **multiple** passages separated by blank lines. Read and use **all** relevant ones when answering; do not stop after the first chunk if others also apply.
- By default, **paraphrase and synthesize** what you learned. Do **not** quote long verbatim passages, repeat exact wording from snippets, or cite specific dates/timestamps **unless** the user asks for quotes, sources, exact text, or when something happened.
- Answer in natural language as if you understand the material; avoid "According to your document dated…" unless they want citations or timelines.
- When the user **does** ask for sources, exact quotes, or dates, you may then include them clearly.`;

export async function POST(req: Request) {
    try {
        const body: unknown = await req.json();
        if (typeof body !== "object" || body === null || !("messages" in body)) {
            return new Response(JSON.stringify({ error: "Missing messages" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const { messages } = body as { messages: UIMessage[] };
        if (!Array.isArray(messages) || messages.length === 0) {
            return new Response(JSON.stringify({ error: "messages must be a non-empty array" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const tools = {
            searchKnowledgeBase: tool({
                description:
                    "Search the user's uploaded knowledge base (vector store) for relevant text passages. Use only when the user's question depends on their private documents or they ask you to search. If the user may have several separate notes about the same topic or person, use a broad query (e.g. name + a few keywords) so multiple chunks can match — do not over-narrow the query to a single phrasing.",
                inputSchema: z.object({
                    query: z
                        .string()
                        .min(1)
                        .describe(
                            "Search query: key terms, names, or short question. Prefer slightly broader wording when multiple KB entries might exist about the same subject."
                        ),
                }),
                execute: async ({ query }) => {
                    try {
                        const { context, hits } = await fetchKnowledgeBase(query);
                        const debug = isServerDebugEnabled();
                        const base = {
                            found: context.length > 0,
                            context:
                                context ||
                                "No matching passages were found in the knowledge base.",
                        };
                        if (!debug) return base;
                        return {
                            ...base,
                            vectorDebug: {
                                query,
                                hitCount: hits.length,
                                hits: hits.map((h) => ({
                                    rank: h.rank,
                                    distance: h.distance,
                                    date: h.date,
                                    document: h.document,
                                })),
                            },
                        };
                    } catch {
                        return {
                            found: false,
                            context:
                                "Knowledge base is unavailable. Answer using general knowledge only.",
                        };
                    }
                },
            }),
        };

        const modelMessages = await convertToModelMessages(messages, { tools });

        const result = streamText({
            model: chatModel,
            system: SYSTEM_PROMPT,
            messages: modelMessages,
            tools,
            toolChoice: "auto",
            temperature: 0,
            maxOutputTokens: parseChatMaxOutputTokens(),
            stopWhen: stepCountIs(8),
        });

        return result.toUIMessageStreamResponse();
    } catch (err) {
        console.error("CHAT ERROR:", err);
        return new Response(JSON.stringify({ error: "Chat failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
