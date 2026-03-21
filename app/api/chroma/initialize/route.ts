import { NextResponse } from "next/server";
import { getChroma, getDefaultEmbeddingFunction } from "@/lib/chroma";

export async function POST() {
    try {
        const chroma = getChroma();
        const defaultEmbeddingFunction = getDefaultEmbeddingFunction();
        // Check if collection already exists
        try {
            const existingCollection = await chroma.getCollection({ name: "docs" });
            return NextResponse.json({
                message: "Collection 'docs' already exists",
                collection: existingCollection.name
            });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            // Collection doesn't exist, create it
        }

        // Create the collection with the default embedding function
        const collection = await chroma.createCollection({
            name: "docs",
            embeddingFunction: defaultEmbeddingFunction
        });

        return NextResponse.json({
            message: "Collection 'docs' created successfully",
            collection: collection.name
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error("INITIALIZE ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET() {
    try {
        const chroma = getChroma();
        // Check if collection exists
        const collection = await chroma.getCollection({ name: "docs" });
        return NextResponse.json({
            message: "Collection 'docs' exists",
            collection: collection.name
        });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return NextResponse.json({
            message: "Collection 'docs' does not exist",
            exists: false
        });
    }
}
