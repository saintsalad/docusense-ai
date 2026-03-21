import { NextResponse } from "next/server";

const TODAY = new Date().toISOString().split("T")[0];

const host = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");
const embedFormatModel = process.env.OLLAMA_CHAT_MODEL ?? "gpt-oss:20b";

const SYSTEM_PROMPT = `You are a knowledge formatting assistant. Turn the user's raw text into a JSON array of chunks for vector search.

FACTUAL INTEGRITY (critical):
- Do NOT invent facts, places, hobbies, travel, culture, or events that are not clearly stated in the input.
- Do NOT "helpfully" expand short notes into longer stories or marketing-style prose.
- Keep the same meaning as the user; you may only trim whitespace and fix obvious typos.

LENGTH AND CHUNKING:
- Short input (one thought, a single sentence, or under ~400 characters): output exactly ONE chunk. The "text" must stay direct and faithful — same substance, not longer. Never add filler to reach a word count.
- Longer documents: split into coherent chunks (by paragraph or topic). You may tighten redundant wording in long text only if nothing factual is lost. Still do not add new information.

DATES:
- If the input contains an explicit date, use it (normalized to YYYY-MM-DD when possible).
- Otherwise use: ${TODAY}

OUTPUT:
- Return ONLY a valid JSON array. No markdown fences, no commentary.
- Schema: [ { "date": "YYYY-MM-DD", "text": "..." }, ... ]`;

type RawChunk = { date: unknown; text: unknown };

function isValidChunk(c: unknown): c is { date: string; text: string } {
    if (typeof c !== "object" || c === null) return false;
    const chunk = c as RawChunk;
    return (
        typeof chunk.date === "string" &&
        typeof chunk.text === "string" &&
        chunk.text.trim().length > 0
    );
}

export async function POST(req: Request) {
    try {
        const body: unknown = await req.json();

        if (typeof body !== "object" || body === null || !("content" in body)) {
            return NextResponse.json({ error: "Missing content" }, { status: 400 });
        }

        const { content } = body as { content: unknown };

        if (typeof content !== "string" || content.trim().length < 10) {
            return NextResponse.json(
                { error: "Content must be a string of at least 10 characters" },
                { status: 400 }
            );
        }

        const trimmed = content.trim();

        /** Skip the LLM for compact notes so wording is never elaborated or hallucinated. */
        const lineCount = trimmed.split("\n").length;
        const paragraphCount = trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
        const isShortSingleBlock =
            trimmed.length <= 500 && paragraphCount <= 1 && lineCount <= 6;

        if (isShortSingleBlock) {
            return NextResponse.json({
                chunks: [{ date: TODAY, text: trimmed }],
            });
        }

        const res = await fetch(`${host}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: embedFormatModel,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: trimmed },
                ],
                stream: false,
                options: {
                    temperature: 0,
                },
            }),
        });

        if (!res.ok) {
            return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
        }

        const data: unknown = await res.json();
        if (typeof data !== "object" || data === null) {
            return NextResponse.json({ error: "Invalid AI response" }, { status: 502 });
        }

        const rawText: string =
            (data as { message?: { content?: unknown } }).message?.content?.toString() ?? "";

        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return NextResponse.json(
                { error: "AI did not return a JSON array — try rephrasing your input" },
                { status: 422 }
            );
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(jsonMatch[0]);
        } catch {
            return NextResponse.json({ error: "Failed to parse AI response as JSON" }, { status: 422 });
        }

        if (!Array.isArray(parsed)) {
            return NextResponse.json({ error: "AI response is not an array" }, { status: 422 });
        }

        const chunks = parsed.filter(isValidChunk);

        if (chunks.length === 0) {
            return NextResponse.json(
                { error: "No valid chunks found in AI response" },
                { status: 422 }
            );
        }

        return NextResponse.json({ chunks });
    } catch (err) {
        console.error("EMBED ERROR:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
