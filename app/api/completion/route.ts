import { streamText } from "ai";
import { chatModel } from "@/lib/chat-model";

/**
 * Single-shot text completion (AI SDK `useCompletion` default endpoint).
 * For multi-turn chat with tools, use POST /api/chat instead.
 */
export async function POST(req: Request) {
    try {
        const body: unknown = await req.json();
        const prompt =
            typeof body === "object" &&
                body !== null &&
                "prompt" in body &&
                typeof (body as { prompt: unknown }).prompt === "string"
                ? (body as { prompt: string }).prompt
                : "";

        if (!prompt.trim()) {
            return new Response(JSON.stringify({ error: "Missing prompt" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const result = streamText({
            model: chatModel,
            system:
                "You are a helpful expert assistant. Answer clearly and concisely.",
            prompt: prompt.trim(),
            temperature: 0,
        });

        return result.toTextStreamResponse();
    } catch (err) {
        console.error("COMPLETION ERROR:", err);
        return new Response(JSON.stringify({ error: "Completion failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
