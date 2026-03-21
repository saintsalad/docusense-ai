import { getChroma, getDefaultEmbeddingFunction } from "@/lib/chroma";

export type KnowledgeRecordSnapshot = {
    id: string;
    document: string;
    date: string;
    source?: string;
};

export async function getKnowledgeRecordById(recordId: string): Promise<KnowledgeRecordSnapshot | null> {
    const collection = await getChroma().getCollection({
        name: "docs",
        embeddingFunction: getDefaultEmbeddingFunction(),
    });

    const res = await collection.get({
        ids: [recordId],
        include: ["documents", "metadatas"],
    });

    const doc = res.documents?.[0];
    if (doc === undefined || doc === null || doc === "") {
        return null;
    }

    const meta = res.metadatas?.[0] as Record<string, unknown> | null | undefined;
    const date = typeof meta?.date === "string" ? meta.date : "unknown";
    const source = typeof meta?.source === "string" ? meta.source : undefined;

    return { id: recordId, document: doc, date, source };
}
