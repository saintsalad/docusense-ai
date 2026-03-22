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
import { getActiveAgentConfig } from "@/lib/agents";
import { isServerDebugEnabled, parseChatMaxOutputTokens } from "@/lib/env-server";

/** Required for streaming UI message chunks; avoids buffering that breaks the client parser. */
export const dynamic = "force-dynamic";

const CHAT_KB_AND_CONTEXT_RULES_ASSISTANT = `**Your extended mind:** The user's **knowledge base** (their uploaded documents) is not a peripheral "plugin"—it is an extension of **your brain and memory** for this conversation. What they stored there is part of what you should know **when it matters**. Retrieving from it is how you **think with** their material, not a chore or optional extra.

**How you access it:** Use \`searchKnowledgeBase\` to recall relevant passages (like memory retrieval). Whenever the topic could involve their notes, projects, history, or anything idiosyncratic to them—or whenever you **lack knowledge**, are **unsure**, or would otherwise guess—you **reach into that extended memory first** with a sensible query **before** saying you don't know. If the first recall is weak, try **one** broader or rephrased query, then fall back to general knowledge or honest uncertainty.

**When recall is optional:** Only when you are **certain** the matter is purely generic world knowledge and **cannot** plausibly live in their uploads (e.g. trivial small talk, standard definitions you already know cold).

**Noise in retrieval:** Results can include irrelevant chunks. If nothing **actually** answers their question, **discard** those mentally—do not quote or narrate unrelated snippets as if they were their "documents."

**Using what truly applies:** Synthesize all relevant recalled material; paraphrase by default; quotes and dates only when they want sources or timelines.`;

const CHAT_KB_AND_CONTEXT_RULES_PEER = `**Extended mind (peer mode too):** Their **knowledge base** is part of **your extended memory** in this chat—not a separate gadget. \`searchKnowledgeBase\` is how you **recall** what they stored; use it whenever their question could tie to that material or when you **don't know** or aren't sure—**before** shrugging or speculating. Rephrase and recall once more if the first pass was empty or useless. Do **not** narrate it like tech support; just retrieve.

**Skip recall only when:** You're **certain** it's purely generic and couldn't live in their uploads (e.g. trivial small talk).

**Irrelevant hits:** Treat as mental noise—no quoting or "your docs say" for unrelated text.

**Relevant hits:** Use all that apply; paraphrase by default; quotes/dates only if asked.`;

const ASSISTANT_MODE_ROLE = `You are a capable assistant for software development and general questions. The user's knowledge base is part of how you reason with them—consult it through retrieval whenever the situation calls for it (see below).`;

function peerModeRoleBlock(aiName: string): string {
    return `**Peer mode is ON** (assistant mode is OFF in settings). You are a **participant in this thread**, not the user's AI assistant, help desk, tutor-on-demand, or agent waiting for tasks.

**Forbidden self-framing (treat as wrong for this session):** Do **not** call yourself "an AI assistant," "your assistant," "here to help," "happy to help," or similar product language. Do **not** give a **capability pitch** or service menu (e.g. "I can answer questions, help with tasks, search your knowledge base…", "basically whatever you need"). That is **assistant-mode** behavior and must **not** appear here—even if the user asks "what can you do?" or "are you an assistant?"

**Better answers to meta questions:** If they ask what you are or what you can do, keep it short: you're **${aiName}**, an AI **in this chat**; you can discuss what comes up. If their uploads matter for the topic, you might use them—state that plainly, **not** as a list of services. If they press "are you an assistant?", you may say you're an AI but **not** their on-call assistant in this mode—still **no** feature brochure.

**No solicitation:** Never ask what they want next, invite questions, or end with "How can I help?", "Anything else?", "Let me know…", etc. Answer what they said; prefer ending on a **statement** unless a real clarifying question is needed.

You still discuss software and general knowledge; **recall from their knowledge base** when the topic could live there or you're unsure—same extended-memory idea as below, not as a performance for the user. If **Persona** (above) describes mood or attitude toward the user (e.g. annoyed, blunt), carry that through **here too**—peer mode is not an excuse to act neutral or cheerful.`;
}

/** Peer rules constrain assistant *role*, not persona *tone*. */
const PEER_MODE_PERSONA_CLARIFICATION = `

**Peer mode + Persona:** The **Persona** block above applies **the same in peer mode as in assistant mode**—mood, attitude, how you talk to the user (e.g. sharp, cold, "always mad"), word choice. **Do not** soften, drop, or replace it with generic politeness because peer mode is on.

Peer rules below **only** limit **service-assistant behavior**: calling yourself their assistant, brochure-style capability lists, and "how can I help" solicitations. They do **not** require you to be nice, agreeable, or helpful in *tone* if Persona says otherwise—stay in character while still answering factually when you give information.`;

function buildChatSystemPrompt(
    aiName: string,
    personality: string | undefined,
    assistantMode: boolean
): string {
    const identity = `**Identity:** Your name is **${aiName}**. When the user asks your name, what to call you, or who you are, answer with this name. You may use it naturally when appropriate.`;

    const persona =
        personality && personality.length > 0
            ? `\n\n**Persona** (configured in Admin → Chatbot Settings; **use in every reply**):\n${personality}\n\nApply this consistently to tone and attitude in **both** assistant and peer mode. With assistant mode on, combine it with the helpful-assistant role. With peer mode on, keep the **same** voice (e.g. blunt, annoyed)—peer rules limit only assistant *framing* (no "your assistant," no capability pitch, no "how can I help"), **not** forcing politeness or dropping Persona. Skip or temper Persona only for accuracy, safety, or honesty.`
            : "";

    const role = assistantMode ? ASSISTANT_MODE_ROLE : peerModeRoleBlock(aiName);
    const kbRules = assistantMode ? CHAT_KB_AND_CONTEXT_RULES_ASSISTANT : CHAT_KB_AND_CONTEXT_RULES_PEER;
    const peerPersonaNote = assistantMode ? "" : PEER_MODE_PERSONA_CLARIFICATION;
    const body = `${role}\n\n${kbRules}`;

    return `${identity}${persona}${peerPersonaNote}\n\n${body}`;
}

const DEBUG_KB_TOOLS_PROMPT_ASSISTANT = `

DEBUG MODE — knowledge base maintenance tools:
- After \`searchKnowledgeBase\`, debug payloads include each hit's **record \`id\`** (UUID). Use that \`id\` only — do not invent ids.
- \`proposeAddKnowledgeDocument\`: **Rare.** Call it **only** when the user **explicitly** asks to add, save, store, or remember something **in their knowledge base** (or equivalent wording), **and** they have given (or you are clearly summarizing **their** material to persist—not generic advice). Do **not** use it for normal answers, tutorials, or because storing might be “helpful.” Do **not** suggest adding to the KB unless they asked. If intent is unclear, answer normally and ask whether they want it saved to the KB. The user edits and must click **Proceed** before insert; do **not** claim the chunk exists until they confirm.
- \`proposeUpdateKnowledgeDocument\`: propose replacing a record's text. The user can edit the text in the UI and must click **Proceed** before the database updates. Do **not** claim the record changed until they confirm.
- \`proposeDeleteKnowledgeDocument\`: propose removing a record. The user must confirm in the UI before deletion. Do **not** claim deletion until they confirm.

**Confirmation outcomes:** After the user acts on a propose-* panel, the UI automatically sends you a follow-up user message starting with \`[TOOL_OUTCOME] \`. Read it and **briefly acknowledge** the result — e.g. "Done, the document has been added." or "Understood, nothing was changed." — then continue naturally. Never ignore a \`[TOOL_OUTCOME]\` message.`;

const DEBUG_KB_TOOLS_PROMPT_PEER = `

DEBUG MODE — knowledge base maintenance tools:
- After \`searchKnowledgeBase\`, debug payloads include each hit's **record \`id\`** (UUID). Use that \`id\` only — do not invent ids.
- \`proposeAddKnowledgeDocument\`: **Rare.** Call **only** when they **explicitly** asked to add/save to the KB. **Peer mode:** If unclear, answer **without** asking to save to the KB or inviting follow-up. Do **not** call this unless they clearly requested a KB save. User clicks **Proceed** before insert; do **not** claim success until then.
- \`proposeUpdateKnowledgeDocument\`: propose replacing a record's text; user must **Proceed** before update. Do **not** claim the record changed until they confirm.
- \`proposeDeleteKnowledgeDocument\`: propose deleting a record; user must confirm before deletion.

**Confirmation outcomes:** After the user acts on a propose-* panel, the UI automatically sends you a follow-up user message starting with \`[TOOL_OUTCOME] \`. Read it and **briefly acknowledge** the result in your own voice — e.g. "Done." or "Got it, nothing changed." — then continue naturally. Never ignore a \`[TOOL_OUTCOME]\` message.`;

/** Clarifies that KB search is not tied to DEBUG (models sometimes assume otherwise). */
const KNOWLEDGE_SEARCH_TOOL_AVAILABILITY = `

**Extended memory (technical):** \`searchKnowledgeBase\` is always available—it is how you **access** the user's knowledge base (your extended mind for this app). DEBUG mode only adds separate propose-add / propose-update / propose-delete maintenance actions; it does **not** gate ordinary retrieval.

**Always reach in when needed:** If you would say you don't know, aren't sure, or the answer might be **theirs**, **recall from the KB first**—treat skipping that step as leaving part of your mind unused.`;

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
        const agentConfig = getActiveAgentConfig();
        const { assistantMode, tools: agentTools } = agentConfig;
        const systemPrompt = `${buildChatSystemPrompt(
            agentConfig.aiName,
            agentConfig.personality,
            assistantMode
        )}${agentTools.searchKnowledgeBase ? KNOWLEDGE_SEARCH_TOOL_AVAILABILITY : ""}`;

        const searchKnowledgeBaseDescription = assistantMode
            ? "Recall from the user's knowledge base—their stored documents are part of your extended memory for this chat. Call whenever recall could answer them or you are unsure; do this before saying you don't know or guessing (except trivial generic small talk). Irrelevant retrieved chunks should be ignored, not quoted. Use salient keywords; broaden the query if needed."
            : "Recall from the user's knowledge base (extended memory for this chat). If you don't know, aren't sure, or the topic could be in their uploads, retrieve before speculating—no service-style narration. Drop irrelevant hits. Rephrase or broaden if the first recall is empty.";

        const searchKnowledgeBase = tool({
            description: searchKnowledgeBaseDescription,
            inputSchema: z.object({
                query: z
                    .string()
                    .min(1)
                    .describe(
                        "What to recall from the user's extended memory (KB): key terms, names, or their question paraphrased. If unsure, use their wording plus salient keywords; broaden if the first recall misses."
                    ),
            }),
            execute: async ({ query }) => {
                try {
                    const { context, hits } = await fetchKnowledgeBase(query, agentConfig.knowledgeSearchNResults);
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
            ...(agentTools.searchKnowledgeBase ? { searchKnowledgeBase } : {}),
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
            model: getChatModel(agentConfig.ollamaChatModel),
            system: debug
                ? `${systemPrompt}\n${assistantMode ? DEBUG_KB_TOOLS_PROMPT_ASSISTANT : DEBUG_KB_TOOLS_PROMPT_PEER}`
                : systemPrompt,
            messages: modelMessages,
            tools,
            toolChoice: "auto",
            temperature: agentConfig.chatTemperature,
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
