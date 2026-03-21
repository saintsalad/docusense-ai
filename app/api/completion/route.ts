import { streamText } from "ai";
import { getChatModel } from "@/lib/chat-model";
import { getChatAiName, getChatTemperature } from "@/lib/chatbot-config";

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

        const name = getChatAiName();
        const result = streamText({
            model: getChatModel(),
            system: `You are **${name}**. Answer clearly and concisely.`,
            prompt: prompt.trim(),
            temperature: getChatTemperature(),
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
