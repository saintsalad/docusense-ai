import { NextResponse } from "next/server";
import { getChroma, getDefaultEmbeddingFunction } from "@/lib/chroma";

export async function POST(req: Request) {
    try {
        const defaultEmbeddingFunction = getDefaultEmbeddingFunction();
        const { text, metadata } = await req.json();
        if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

        // Get the existing collection (should be initialized first)
        const collection = await getChroma().getCollection({
            name: "docs",
            embeddingFunction: defaultEmbeddingFunction,
        });

        const id = crypto.randomUUID();
        const incoming =
            typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
                ? (metadata as Record<string, string | number | boolean>)
                : {};
        const metadatas = [
            {
                ...incoming,
                model: defaultEmbeddingFunction.name ?? "default-embed",
                savedBy: "user",
                savedVia: "api_add",
                authorLabel: "Local user · API",
            },
        ];
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
