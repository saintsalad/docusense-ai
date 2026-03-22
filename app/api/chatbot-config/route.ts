import { NextResponse } from "next/server";
import { z } from "zod";
import {
    getChatbotSettingsFormValues,
    writeChatbotConfigFile,
    type ChatbotConfigFile,
} from "@/lib/chatbot-config";

export const dynamic = "force-dynamic";

const putSchema = z.object({
    aiName: z.string().max(80),
    aiPersonality: z.string().max(8_000),
    assistantMode: z.boolean(),
    ollamaChatModel: z.string().min(1).max(200),
    chatTemperature: z.number().min(0).max(2),
    knowledgeSearchNResults: z.number().int().min(1).max(50),
});

export async function GET() {
    try {
        const values = getChatbotSettingsFormValues();
        return NextResponse.json({ ok: true as const, config: values });
    } catch (e) {
        console.error("chatbot-config GET:", e);
        return NextResponse.json(
            { ok: false as const, error: e instanceof Error ? e.message : "Failed to read config" },
            { status: 500 }
        );
    }
}

export async function PUT(req: Request) {
    let json: unknown;
    try {
        json = await req.json();
    } catch {
        return NextResponse.json({ ok: false as const, error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = putSchema.safeParse(json);
    if (!parsed.success) {
        return NextResponse.json(
            { ok: false as const, error: parsed.error.flatten().fieldErrors },
            { status: 400 }
        );
    }

    const d = parsed.data;
    const partial: ChatbotConfigFile = {
        aiName: d.aiName.trim(),
        assistantMode: d.assistantMode,
        ollamaChatModel: d.ollamaChatModel.trim(),
        chatTemperature: d.chatTemperature,
        knowledgeSearchNResults: d.knowledgeSearchNResults,
    };
    if (d.aiPersonality.trim() !== "") {
        partial.aiPersonality = d.aiPersonality;
    }

    try {
        writeChatbotConfigFile(partial, { clearAiPersonality: d.aiPersonality.trim() === "" });
        return NextResponse.json({ ok: true as const, config: getChatbotSettingsFormValues() });
    } catch (e) {
        console.error("chatbot-config PUT:", e);
        return NextResponse.json(
            { ok: false as const, error: e instanceof Error ? e.message : "Failed to save config" },
            { status: 500 }
        );
    }
}
