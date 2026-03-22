import { NextResponse } from "next/server";
import { getAssistantMode, getChatAiName, getChatAiPersonality } from "@/lib/chatbot-config";
import { isServerDebugEnabled } from "@/lib/env-server";

export const dynamic = "force-dynamic";

export async function GET() {
    if (!isServerDebugEnabled()) {
        return NextResponse.json({ debug: false as const });
    }

    const personality = getChatAiPersonality();

    return NextResponse.json({
        debug: true as const,
        aiName: getChatAiName(),
        aiPersonality: personality ?? "",
        assistantMode: getAssistantMode(),
    });
}
