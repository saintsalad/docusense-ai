import { NextResponse } from "next/server";

const TODAY = new Date().toISOString().split("T")[0];

const SYSTEM_PROMPT = `You are a knowledge formatting assistant. Transform raw text, notes, or journal entries into structured JSON chunks optimized for vector embeddings.

Rules:
- Each chunk should be 2–4 sentences (25–60 words)
- Keep related ideas together; do not split them
- Preserve all important details and context
- If no date is found, use today's date: ${TODAY}
- Return ONLY a valid JSON array — no markdown, no explanation

Output format:
[
  { "date": "YYYY-MM-DD", "text": "chunk text here" },
  { "date": "YYYY-MM-DD", "text": "next chunk" }
]`;

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

        const res = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-oss:20b",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content },
                ],
                stream: false,
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
