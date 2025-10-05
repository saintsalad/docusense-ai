import { NextResponse } from "next/server";
import { chroma } from "@/lib/chroma";

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const collectionName = searchParams.get("collection") || "docs";
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Record ID is required",
                },
                { status: 400 }
            );
        }

        // Get the collection
        const collection = await chroma.getCollection({ name: collectionName });

        // Delete the record
        await collection.delete({
            ids: [id],
        });

        return NextResponse.json({
            success: true,
            message: `Record ${id} deleted successfully`,
            deletedId: id,
        });
    } catch (error) {
        console.error("Error deleting record:", error);
        return NextResponse.json(
            {
                success: false,
                error: (error as Error).message,
            },
            { status: 500 }
        );
    }
}

