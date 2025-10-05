import { NextResponse } from "next/server";
import { chroma, defaultEmbeddingFunction } from "@/lib/chroma";
import { getEmbedding } from "@/lib/embedding";

export async function POST(req: Request) {
    try {
        const { query, n = 3 } = await req.json();
        if (!query) return NextResponse.json({ error: "Missing query" }, { status: 400 });

        const qVec = await getEmbedding(query);
        const collection = await chroma.getCollection({ name: "docs", embeddingFunction: defaultEmbeddingFunction });

        const results = await collection.query({
            queryEmbeddings: [qVec],
            nResults: n,
            include: ["documents", "metadatas", "distances"],
        });

        return NextResponse.json(results);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        console.error("QUERY ERROR:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
