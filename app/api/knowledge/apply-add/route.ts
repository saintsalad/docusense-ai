import { NextResponse } from "next/server";
import { z } from "zod";
import { isServerDebugEnabled } from "@/lib/env-server";
import { getChroma, getDefaultEmbeddingFunction } from "@/lib/chroma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
    document: z.string().min(1, "Document text is required"),
    source: z.string().min(1).optional(),
});

export async function POST(req: Request) {
    if (!isServerDebugEnabled()) {
        return NextResponse.json({ ok: false, error: "Debug mode is off" }, { status: 403 });
    }

    let json: unknown;
    try {
        json = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
        return NextResponse.json(
            { ok: false, error: parsed.error.flatten().fieldErrors },
            { status: 400 }
        );
    }

    const { document, source } = parsed.data;

    try {
        const embeddingFn = getDefaultEmbeddingFunction();
        const collection = await getChroma().getCollection({
            name: "docs",
            embeddingFunction: embeddingFn,
        });

        const recordId = crypto.randomUUID();
        await collection.add({
            ids: [recordId],
            documents: [document],
            metadatas: [
                {
                    date: new Date().toISOString(),
                    source: source ?? "debug-add",
                    model: embeddingFn.name ?? "default-embed",
                },
            ],
        });

        return NextResponse.json({ ok: true, recordId });
    } catch (e) {
        console.error("apply-add:", e);
        return NextResponse.json(
            { ok: false, error: e instanceof Error ? e.message : "Add failed" },
            { status: 500 }
        );
    }
}
