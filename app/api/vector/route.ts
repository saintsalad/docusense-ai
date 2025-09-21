// app/api/embed/route.ts
import { NextResponse } from "next/server";
import db from "@/lib/sqlite/db";
import { pipeline } from "@xenova/transformers";

// ⚡️ initialize embedder once (not per request)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedderPromise: any;
function getEmbedder() {
    if (!embedderPromise) {
        embedderPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }
    return embedderPromise;
}

// POST: Insert a new embedding
export async function POST(req: Request) {
    try {
        const { id, text } = await req.json();
        if (!id || !text) {
            return NextResponse.json({ error: "id and text are required" }, { status: 400 });
        }

        const embedder = await getEmbedder();
        const output = await embedder(text);
        const embedding = Array.from(output.data[0]);

        const stmt = db.prepare(`
      INSERT OR REPLACE INTO embeddings (id, content, embedding)
      VALUES (?, ?, ?)
    `);
        stmt.run(id, text, JSON.stringify(embedding));

        return NextResponse.json({ success: true, id });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// GET: Query similar embeddings
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const queryText = searchParams.get("q");
        const limit = parseInt(searchParams.get("limit") || "5", 10);

        if (!queryText) {
            return NextResponse.json({ error: "q (query text) is required" }, { status: 400 });
        }

        const embedder = await getEmbedder();
        const output = await embedder(queryText);
        const queryVector = JSON.stringify(Array.from(output.data[0]));

        const stmt = db.prepare(`
      SELECT id, content, distance(embedding, ?) AS score
      FROM embeddings
      ORDER BY score
      LIMIT ?
    `);

        const results = stmt.all(queryVector, limit);
        return NextResponse.json({ results });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
