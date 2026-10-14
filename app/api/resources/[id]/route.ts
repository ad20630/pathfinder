import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { updateResourceSchema } from "@/lib/validation";

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/resources/[id]">) {
  const { id } = await ctx.params;
  const parsed = updateResourceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { status, confirm } = parsed.data;

  // Any update or confirmation refreshes updatedAt, which resets the expiry clock
  const [row] = await db
    .update(resources)
    .set({
      updatedAt: new Date(),
      ...(status && { status }),
      ...(confirm && { confirmations: sql`${resources.confirmations} + 1` }),
    })
    .where(eq(resources.id, id))
    .returning();

  return row ? Response.json(row) : Response.json({ error: "Not found" }, { status: 404 });
}
