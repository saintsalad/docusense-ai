import { NextResponse } from "next/server";
import { z } from "zod";
import { isServerDebugEnabled } from "@/lib/env-server";
import { getChroma, getDefaultEmbeddingFunction } from "@/lib/chroma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
    document: z.string().min(1, "Document text is required"),
    contextAgentName: z.string().max(80).optional(),
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

    const { document, contextAgentName: rawAgentName } = parsed.data;
    const contextAgentName =
        typeof rawAgentName === "string" ? rawAgentName.trim().slice(0, 80) : "";
    const authorLabel = contextAgentName.length > 0 ? contextAgentName : "Current Agent";

    try {
        const embeddingFn = getDefaultEmbeddingFunction();
        const collection = await getChroma().getCollection({
            name: "docs",
            embeddingFunction: embeddingFn,
        });

        const recordId = crypto.randomUUID();
        const meta: Record<string, string> = {
            date: new Date().toISOString(),
            source: "chat-request",
            model: embeddingFn.name ?? "default-embed",
            savedBy: "agent",
            savedVia: "chat_kb_confirm",
            authorLabel,
        };
        if (contextAgentName.length > 0) {
            meta.contextAgentName = contextAgentName;
        }

        await collection.add({
            ids: [recordId],
            documents: [document],
            metadatas: [meta],
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
