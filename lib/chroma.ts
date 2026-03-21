import { createRequire } from "node:module";
import { ChromaClient, type EmbeddingFunction } from "chromadb";

const nodeRequire = createRequire(import.meta.url);

let chromaClient: ChromaClient | undefined;

/**
 * Lazy singleton so production builds do not load `@chroma-core/default-embed`
 * (ONNX native bindings) during Next.js "Collecting page data".
 */
export function getChroma(): ChromaClient {
    if (!chromaClient) {
        chromaClient = new ChromaClient({
            path: "http://localhost:8000",
        });
    }
    return chromaClient;
}

let defaultEmbeddingFunctionInstance: EmbeddingFunction | undefined;

export function getDefaultEmbeddingFunction(): EmbeddingFunction {
    if (!defaultEmbeddingFunctionInstance) {
        const { DefaultEmbeddingFunction } = nodeRequire("@chroma-core/default-embed") as {
            DefaultEmbeddingFunction: new () => EmbeddingFunction;
        };
        defaultEmbeddingFunctionInstance = new DefaultEmbeddingFunction();
    }
    return defaultEmbeddingFunctionInstance;
}
