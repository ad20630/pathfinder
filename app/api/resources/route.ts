import { and, between, eq, gt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { scenario } from "@/config/scenario";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { createResourceSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";

// GET /api/resources?type=hiring&bbox=south,west,north,east
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const conds = [
    gt(resources.updatedAt, new Date(Date.now() - scenario.expiryHours * 3600_000)),
  ];

  const type = sp.get("type");
  if (type) conds.push(eq(resources.type, type));

  const bbox = sp.get("bbox")?.split(",").map(Number);
  if (bbox?.length === 4 && bbox.every(Number.isFinite)) {
    const [south, west, north, east] = bbox;
    conds.push(between(resources.lat, south, north));
    // bbox crossing the antimeridian is ignored; fine for a regional crisis map
    conds.push(between(resources.lng, west, east));
  }

  const rows = await db
    .select()
    .from(resources)
    .where(and(...conds))
    .limit(500);
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "post-resource", 20);
  if (limited) return limited;
  const parsed = createResourceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const [row] = await db.insert(resources).values(parsed.data).returning();
  return Response.json(row, { status: 201 });
}
