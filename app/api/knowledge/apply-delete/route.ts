import { NextResponse } from "next/server";
import { z } from "zod";
import { isServerDebugEnabled } from "@/lib/env-server";
import { getChroma } from "@/lib/chroma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
    recordId: z.string().uuid(),
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

    const { recordId } = parsed.data;

    try {
        const collection = await getChroma().getCollection({ name: "docs" });

        const existing = await collection.get({
            ids: [recordId],
            include: ["documents"],
        });
        if (!existing.documents?.[0]) {
            return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 });
        }

        await collection.delete({ ids: [recordId] });

        return NextResponse.json({ ok: true, recordId });
    } catch (e) {
        console.error("apply-delete:", e);
        return NextResponse.json(
            { ok: false, error: e instanceof Error ? e.message : "Delete failed" },
            { status: 500 }
        );
    }
}
