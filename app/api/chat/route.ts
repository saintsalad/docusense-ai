import {
    streamText,
    tool,
    stepCountIs,
    convertToModelMessages,
    type UIMessage,
} from "ai";
import { z } from "zod";
import { getChatModel } from "@/lib/chat-model";
import { fetchKnowledgeBase } from "@/lib/knowledge-context";
import { getKnowledgeRecordById } from "@/lib/knowledge-record";
import { getChatAiName, getChatAiPersonality, getChatTemperature } from "@/lib/chatbot-config";
import { isServerDebugEnabled, parseChatMaxOutputTokens } from "@/lib/env-server";

/** Required for streaming UI message chunks; avoids buffering that breaks the client parser. */
export const dynamic = "force-dynamic";

const CHAT_SYSTEM_PROMPT_BODY = `You are a capable assistant for software development and general questions.

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

function buildChatSystemPrompt(aiName: string, personality: string | undefined): string {
    const identity = `**Identity:** Your name is **${aiName}**. When the user asks your name, what to call you, or who you are, answer with this name. You may use it naturally in greetings when appropriate.`;

    const persona =
        personality && personality.length > 0
            ? `\n\n**Persona** (configured in Admin → Chatbot Settings or via environment; follow consistently):\n${personality}\n\nExpress this persona in tone and style whenever it does not conflict with accuracy, safety, honesty, or the operational rules below.`
            : "";

    return `${identity}${persona}\n\n${CHAT_SYSTEM_PROMPT_BODY}`;
}

const DEBUG_KB_TOOLS_PROMPT = `

DEBUG MODE — knowledge base maintenance tools:
- After \`searchKnowledgeBase\`, debug payloads include each hit's **record \`id\`** (UUID). Use that \`id\` only — do not invent ids.
- \`proposeAddKnowledgeDocument\`: **Rare.** Call it **only** when the user **explicitly** asks to add, save, store, or remember something **in their knowledge base** (or equivalent wording), **and** they have given (or you are clearly summarizing **their** material to persist—not generic advice). Do **not** use it for normal answers, tutorials, or because storing might be “helpful.” Do **not** suggest adding to the KB unless they asked. If intent is unclear, answer normally and ask whether they want it saved to the KB. The user edits and must click **Proceed** before insert; do **not** claim the chunk exists until they confirm.
- \`proposeUpdateKnowledgeDocument\`: propose replacing a record's text. The user can edit the text in the UI and must click **Proceed** before the database updates. Do **not** claim the record changed until they confirm.
- \`proposeDeleteKnowledgeDocument\`: propose removing a record. The user must confirm in the UI before deletion. Do **not** claim deletion until they confirm.`;

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

        const debug = isServerDebugEnabled();
        const systemPrompt = buildChatSystemPrompt(getChatAiName(), getChatAiPersonality());

        const searchKnowledgeBase = tool({
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
                                id: h.id,
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
        });

        const proposeAddKnowledgeDocument = tool({
            description:
                "DEBUG: Propose inserting ONE new knowledge-base chunk. Use ONLY when the user clearly asked to add/save/store/remember something in their knowledge base AND the text is what they want persisted (their notes, specs, etc.)—not for general chat answers or unprompted suggestions. If they did not ask to save to the KB, do not call this. For edits to an existing chunk, use proposeUpdateKnowledgeDocument with the UUID from searchKnowledgeBase. User must click Proceed before the vector DB writes; do not claim success until then.",
            inputSchema: z.object({
                newDocumentText: z
                    .string()
                    .min(1)
                    .describe("Full text for the new chunk to store and embed."),
                source: z
                    .string()
                    .min(1)
                    .optional()
                    .describe("Optional metadata label (e.g. pasted-note, meeting-notes)."),
            }),
            execute: async ({ newDocumentText, source }) => {
                return {
                    pendingUserConfirmation: true as const,
                    action: "add" as const,
                    proposedDocument: newDocumentText,
                    source,
                };
            },
        });

        const proposeUpdateKnowledgeDocument = tool({
            description:
                "DEBUG: Propose replacing the full document text of a knowledge base record. Pass the Chroma record UUID from a recent searchKnowledgeBase debug hit and the new text. The user will edit if needed and must click Proceed before the vector DB updates.",
            inputSchema: z.object({
                recordId: z.string().uuid().describe("UUID from searchKnowledgeBase vectorDebug.hits[].id"),
                newDocumentText: z
                    .string()
                    .min(1)
                    .describe("Complete replacement text for this chunk (not a diff)."),
            }),
            execute: async ({ recordId, newDocumentText }) => {
                const rec = await getKnowledgeRecordById(recordId);
                if (!rec) {
                    return {
                        pendingUserConfirmation: false as const,
                        ok: false as const,
                        error: "Record not found. Search again and use an id from vectorDebug hits.",
                    };
                }
                return {
                    pendingUserConfirmation: true as const,
                    action: "update" as const,
                    recordId,
                    currentDocument: rec.document,
                    proposedDocument: newDocumentText,
                    date: rec.date,
                    source: rec.source,
                };
            },
        });

        const proposeDeleteKnowledgeDocument = tool({
            description:
                "DEBUG: Propose deleting a knowledge base record by id. The user must confirm in the UI before the vector DB deletes it.",
            inputSchema: z.object({
                recordId: z.string().uuid().describe("UUID from searchKnowledgeBase vectorDebug.hits[].id"),
            }),
            execute: async ({ recordId }) => {
                const rec = await getKnowledgeRecordById(recordId);
                if (!rec) {
                    return {
                        pendingUserConfirmation: false as const,
                        ok: false as const,
                        error: "Record not found. Search again and use an id from vectorDebug hits.",
                    };
                }
                return {
                    pendingUserConfirmation: true as const,
                    action: "delete" as const,
                    recordId,
                    previewDocument: rec.document,
                    date: rec.date,
                    source: rec.source,
                };
            },
        });

        const tools = {
            searchKnowledgeBase,
            ...(debug
                ? {
                    proposeAddKnowledgeDocument,
                    proposeUpdateKnowledgeDocument,
                    proposeDeleteKnowledgeDocument,
                }
                : {}),
        };

        const modelMessages = await convertToModelMessages(messages, { tools });

        const result = streamText({
            model: getChatModel(),
            system: debug ? `${systemPrompt}\n${DEBUG_KB_TOOLS_PROMPT}` : systemPrompt,
            messages: modelMessages,
            tools,
            toolChoice: "auto",
            temperature: getChatTemperature(),
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
