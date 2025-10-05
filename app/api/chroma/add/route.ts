import { NextResponse } from "next/server";
import { chroma, defaultEmbeddingFunction } from "@/lib/chroma";

export async function POST(req: Request) {
    try {
        const { text, metadata } = await req.json();
        if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

        // Get the existing collection (should be initialized first)
        const collection = await chroma.getCollection({ name: "docs", embeddingFunction: defaultEmbeddingFunction });

        const id = crypto.randomUUID();
        const metadatas = [{
            ...metadata,
            model: defaultEmbeddingFunction.name
        }]
        await collection.add({
            ids: [id],
            documents: [text],
            metadatas: metadatas,
        });

        return NextResponse.json({ ok: true, id });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        console.error("ADD ERROR:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
