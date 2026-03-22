import { agentSchema, getAgentById, updateAgent, deleteAgent } from "@/lib/agents";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
    try {
        const { id } = await ctx.params;
        const agent = getAgentById(id);
        if (!agent) return Response.json({ ok: false, error: "Agent not found" }, { status: 404 });
        return Response.json({ ok: true, agent });
    } catch (err) {
        console.error("GET /api/agents/[id] error:", err);
        return Response.json({ ok: false, error: "Failed to get agent" }, { status: 500 });
    }
}

const patchSchema = agentSchema.omit({ id: true, createdAt: true }).partial();

export async function PUT(req: Request, ctx: Ctx) {
    try {
        const { id } = await ctx.params;
        const body: unknown = await req.json();
        const parsed = patchSchema.safeParse(body);
        if (!parsed.success) {
            return Response.json(
                { ok: false, error: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }
        const updated = updateAgent(id, parsed.data);
        if (!updated) return Response.json({ ok: false, error: "Agent not found" }, { status: 404 });
        return Response.json({ ok: true, agent: updated });
    } catch (err) {
        console.error("PUT /api/agents/[id] error:", err);
        return Response.json({ ok: false, error: "Failed to update agent" }, { status: 500 });
    }
}

export async function DELETE(_req: Request, ctx: Ctx) {
    try {
        const { id } = await ctx.params;
        const deleted = deleteAgent(id);
        if (!deleted) return Response.json({ ok: false, error: "Agent not found" }, { status: 404 });
        return Response.json({ ok: true });
    } catch (err) {
        console.error("DELETE /api/agents/[id] error:", err);
        return Response.json({ ok: false, error: "Failed to delete agent" }, { status: 500 });
    }
}
