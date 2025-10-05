import { NextResponse } from "next/server";
import { chroma } from "@/lib/chroma";

export async function GET() {
    try {
        const version = await chroma.version();
        const collections = await chroma.listCollections();

        const details = await Promise.all(
            collections.map(async (c) => {
                const col = await chroma.getCollection({ name: c.name });
                const count = await col.count();

                // Fetch a few embeddings to estimate vector dimension and size
                let vectorDimension = 0;
                let avgEmbeddingSize = 0;

                try {
                    const sample = await col.get({
                        limit: 3,
                        include: ["embeddings", "metadatas"],
                    });

                    if (sample.embeddings?.length) {
                        const first = sample.embeddings[0];
                        vectorDimension = first.length;
                        const totalBytes = sample.embeddings.reduce((acc, emb) => {
                            return acc + emb.length * 8; // float64 ~ 8 bytes per number
                        }, 0);
                        avgEmbeddingSize = totalBytes / sample.embeddings.length;
                    }


                } catch (err) {
                    console.warn(`Failed to analyze collection ${c.name}:`, err);
                }

                // Approximate storage = (count × avg emb size)
                const storageUsed = (count * avgEmbeddingSize) / 1024; // KB

                return {
                    name: c.name,
                    count,
                    vectorDimension,
                    avgEmbeddingSize: `${(avgEmbeddingSize / 1024).toFixed(2)} KB`,
                    storageUsed: `${storageUsed.toFixed(2)} KB`,
                };
            })
        );

        const totalVectors = details.reduce((sum, d) => sum + d.count, 0);
        const totalStorage = details.reduce((sum, d) => {
            const num = parseFloat(d.storageUsed);
            return sum + (isNaN(num) ? 0 : num);
        }, 0);

        return NextResponse.json({
            status: "Connected",
            version,
            totalCollections: details.length,
            totalVectors,
            totalStorage: `${totalStorage.toFixed(2)} KB`,
            collections: details,
        });
    } catch (e) {
        return NextResponse.json({
            status: "Disconnected",
            error: (e as Error).message,
        });
    }
}
