import { NextResponse } from "next/server";
import { chroma } from "@/lib/chroma";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const collectionName = searchParams.get("collection") || "docs";
        const limit = parseInt(searchParams.get("limit") || "100");
        const offset = parseInt(searchParams.get("offset") || "0");

        // Get the collection
        const collection = await chroma.getCollection({ name: collectionName });

        // Get all documents with metadata
        const results = await collection.get({
            limit,
            offset,
            include: ["documents", "metadatas"],
        });

        // Transform the data into a more usable format
        const records = results.ids.map((id, index) => {
            const metadata = results.metadatas?.[index] || {};
            const document = results.documents?.[index] || "";

            // Determine type from metadata or ID pattern
            let type: 'custom' | 'journal' | 'strava' | 'notion' = 'custom';

            if (metadata.type) {
                type = metadata.type as 'custom' | 'journal' | 'strava' | 'notion';
            } else if (id.startsWith('journal_')) {
                type = 'journal';
            } else if (id.startsWith('strava_')) {
                type = 'strava';
            } else if (id.startsWith('notion_')) {
                type = 'notion';
            }

            return {
                id,
                content: document,
                type,
                createdAt: metadata.createdAt || metadata.created_at || new Date().toISOString(),
                metadata,
            };
        });

        // Get total count for pagination
        const totalCount = await collection.count();

        return NextResponse.json({
            success: true,
            collection: collectionName,
            records,
            pagination: {
                total: totalCount,
                limit,
                offset,
                hasMore: offset + limit < totalCount,
            },
        });
    } catch (error) {
        console.error("Error listing records:", error);
        return NextResponse.json(
            {
                success: false,
                error: (error as Error).message,
                records: [],
            },
            { status: 500 }
        );
    }
}

