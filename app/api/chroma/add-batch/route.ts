import { NextResponse } from "next/server";
import { getChroma, getDefaultEmbeddingFunction } from "@/lib/chroma";

interface Chunk {
    date: string;
    text: string;
}

function isValidChunk(c: unknown): c is Chunk {
    if (typeof c !== "object" || c === null) return false;
    const chunk = c as Chunk;
    return (
        typeof chunk.date === "string" &&
        typeof chunk.text === "string" &&
        chunk.text.trim().length > 0
    );
}

export async function POST(req: Request) {
    try {
        const body: unknown = await req.json();

        if (typeof body !== "object" || body === null) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }

        const { chunks, source } = body as { chunks: unknown; source?: unknown };

        if (!Array.isArray(chunks) || chunks.length === 0) {
            return NextResponse.json({ error: "Missing or empty chunks array" }, { status: 400 });
        }

        const validChunks = chunks.filter(isValidChunk);

        if (validChunks.length === 0) {
            return NextResponse.json({ error: "No valid chunks to insert" }, { status: 400 });
        }

        const defaultEmbeddingFunction = getDefaultEmbeddingFunction();
        const collection = await getChroma().getCollection({
            name: "docs",
            embeddingFunction: defaultEmbeddingFunction,
        });

        const ids = validChunks.map(() => crypto.randomUUID());
        const documents = validChunks.map((c) => c.text);
        const metadatas = validChunks.map((c) => ({
            date: c.date,
            source: typeof source === "string" ? source : "manual",
            model: defaultEmbeddingFunction.name ?? "default-embed",
        }));

        await collection.add({ ids, documents, metadatas });

        return NextResponse.json({ ok: true, inserted: validChunks.length });
    } catch (err) {
        console.error("ADD BATCH ERROR:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Internal server error" },
            { status: 500 }
        );
    }
}
