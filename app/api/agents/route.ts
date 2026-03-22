import { z } from "zod";
import { listAgents, createAgent, agentSchema } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const agents = listAgents();
        return Response.json({ ok: true, agents });
    } catch (err) {
        console.error("GET /api/agents error:", err);
        return Response.json({ ok: false, error: "Failed to list agents" }, { status: 500 });
    }
}

const createSchema = agentSchema.omit({ id: true, createdAt: true });

export async function POST(req: Request) {
    try {
        const body: unknown = await req.json();
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) {
            return Response.json(
                { ok: false, error: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }
        const agent = createAgent(parsed.data);
        return Response.json({ ok: true, agent }, { status: 201 });
    } catch (err) {
        console.error("POST /api/agents error:", err);
        return Response.json({ ok: false, error: "Failed to create agent" }, { status: 500 });
    }
}
