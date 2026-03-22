import { getChroma, getDefaultEmbeddingFunction } from "@/lib/chroma";
import { getKnowledgeSearchNResults } from "@/lib/chatbot-config";

export type KnowledgeHit = {
    rank: number;
    /** Chroma record id (from query results). */
    id: string;
    /** Chroma distance for this space; lower = closer match (typ. L2). */
    distance: number;
    date: string;
    document: string;
};

export type KnowledgeFetchResult = {
    /** All retrieved chunks joined for the model (same order as hits). */
    context: string;
    hits: KnowledgeHit[];
};

/**
 * Semantic search over the `docs` collection for RAG / tool execution.
 */
export async function fetchKnowledgeBase(query: string, nResultsOverride?: number): Promise<KnowledgeFetchResult> {
    const collection = await getChroma().getCollection({
        name: "docs",
        embeddingFunction: getDefaultEmbeddingFunction(),
    });

    const nResults = nResultsOverride ?? getKnowledgeSearchNResults();

    const results = await collection.query({
        queryTexts: [query],
        nResults,
        include: ["documents", "metadatas", "distances"],
    });

    const docs = results.documents?.[0] ?? [];
    const metas = results.metadatas?.[0] ?? [];
    const distances = results.distances?.[0] ?? [];
    const rowIds = results.ids?.[0] ?? [];

    if (docs.length === 0) {
        return { context: "", hits: [] };
    }

    const hits: KnowledgeHit[] = docs.map((doc, i) => ({
        rank: i + 1,
        id: typeof rowIds[i] === "string" ? rowIds[i] : "",
        distance: typeof distances[i] === "number" ? distances[i] : Number.NaN,
        date: (metas[i] as { date?: string } | null)?.date ?? "unknown",
        document: doc ?? "",
    }));

    const context = hits
        .map((h) => `[${h.date}] ${h.document}`)
        .join("\n\n");

    return { context, hits };
}

/** @deprecated Prefer fetchKnowledgeBase for structured hits */
export async function fetchKnowledgeContext(query: string): Promise<string> {
    const { context } = await fetchKnowledgeBase(query);
    return context;
}
