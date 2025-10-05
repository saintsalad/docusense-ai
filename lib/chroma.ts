import { ChromaClient } from "chromadb";
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";

export const chroma = new ChromaClient({
    path: "http://localhost:8000", // your ChromaDB instance
});

export const defaultEmbeddingFunction = new DefaultEmbeddingFunction();
