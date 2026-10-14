import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { scenario, statusInfo, typeInfo } from "@/config/scenario";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { GEMINI_MODEL, generate, getGemini } from "@/lib/gemini";
import { rateLimit } from "@/lib/rateLimit";

// Summaries only change when the marker does, so cache them to save Gemini quota.
// (In-memory: per server instance, which is fine for a demo.)
const cache = new Map<string, string>();

// POST { id } -> { summary }  One-line plain-language summary of a marker.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "summarize", 30);
  if (limited) return limited;
  const body = z
    .object({ id: z.string().uuid() })
    .safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "id required" }, { status: 400 });

  const ai = getGemini();
  if (!ai) return Response.json({ error: "GEMINI_API_KEY not set" }, { status: 503 });

  const [r] = await db.select().from(resources).where(eq(resources.id, body.data.id));
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });

  const cacheKey = `${r.id}:${r.updatedAt.getTime()}`;
  const cached = cache.get(cacheKey);
  if (cached) return Response.json({ summary: cached });

  const ageMin = Math.round((Date.now() - r.updatedAt.getTime()) / 60_000);
  const facts = {
    type: typeInfo(r.type).label,
    title: r.title,
    description: r.description,
    skills: r.skills,
    link: r.link ? "yes" : "no",
    status: statusInfo(r.status).label,
    minutesSinceLastUpdate: ageMin,
    peopleWhoConfirmedItIsStillThere: r.confirmations,
    contact: r.contact,
  };

  try {
    const res = await generate(ai, {
      model: GEMINI_MODEL,
      contents:
        `Context: ${scenario.aiContext}. Write a plain 1-2 sentence description (max 40 words) of this map marker ` +
        `for ${scenario.ui.summaryAudience}: what it is, who it suits (use the skills) and anything key like pay or cost. ` +
        `Briefly note how fresh the information is. Use only the facts given; do not invent details.\n\n${JSON.stringify(facts)}`,
    });
    const summary = res.text?.trim() ?? "";
    if (summary) cache.set(cacheKey, summary);
    return Response.json({ summary });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "AI unavailable" }, { status: 502 });
  }
}
