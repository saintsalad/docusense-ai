import { z } from "zod";
import { getActiveAgent, getActiveAgentId, setActiveAgentId, getAgentById } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const activeAgentId = getActiveAgentId();
        const agent = getActiveAgent();
        return Response.json({ ok: true, activeAgentId, agent });
    } catch (err) {
        console.error("GET /api/agents/active error:", err);
        return Response.json({ ok: false, error: "Failed to get active agent" }, { status: 500 });
    }
}

const putSchema = z.object({
    activeAgentId: z.string().nullable(),
});

export async function PUT(req: Request) {
    try {
        const body: unknown = await req.json();
        const parsed = putSchema.safeParse(body);
        if (!parsed.success) {
            return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });
        }
        const { activeAgentId } = parsed.data;
        if (activeAgentId !== null) {
            const exists = getAgentById(activeAgentId);
            if (!exists) {
                return Response.json({ ok: false, error: "Agent not found" }, { status: 404 });
            }
        }
        setActiveAgentId(activeAgentId);
        return Response.json({ ok: true, activeAgentId });
    } catch (err) {
        console.error("PUT /api/agents/active error:", err);
        return Response.json({ ok: false, error: "Failed to set active agent" }, { status: 500 });
    }
}
