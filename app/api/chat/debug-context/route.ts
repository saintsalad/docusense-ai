import { NextResponse } from "next/server";
import { getActiveAgentConfig } from "@/lib/agents";
import { isServerDebugEnabled } from "@/lib/env-server";

export const dynamic = "force-dynamic";

export async function GET() {
    if (!isServerDebugEnabled()) {
        return NextResponse.json({ debug: false as const });
    }

    const config = getActiveAgentConfig();

    return NextResponse.json({
        debug: true as const,
        aiName: config.aiName,
        aiPersonality: config.personality ?? "",
        assistantMode: config.assistantMode,
    });
}
