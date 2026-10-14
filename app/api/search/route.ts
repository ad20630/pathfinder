import { desc, gt } from "drizzle-orm";
import { Type } from "@google/genai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { scenario, statusIds, typeIds } from "@/config/scenario";
import { db } from "@/db";
import { resources, type Resource } from "@/db/schema";
import { GEMINI_MODEL, generate, getGemini } from "@/lib/gemini";
import { rateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  query: z.string().trim().min(1).max(500),
  // Map center, used to rank by distance
  lat: z.number().optional(),
  lng: z.number().optional(),
});

type Row = Resource & { distanceKm: number | null };

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Used when Gemini is unavailable: score resources by words shared with the query
function keywordMatch(query: string, rows: Row[]) {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  return rows
    .map((r) => {
      const label = scenario.types.find((t) => t.id === r.type)?.label ?? "";
      const hay = `${r.type} ${label} ${r.title} ${r.description} ${r.skills}`.toLowerCase();
      return { r, score: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.r.distanceKm ?? 0) - (b.r.distanceKm ?? 0))
    .map((x) => x.r.id);
}

// POST { query, lat?, lng? } -> { answer, skills, plan, results }
//   skills:  transferable skills Gemini inferred from the person's background
//   plan:    short next steps, each optionally tied to one result
//   results: matching listings, best first
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "search", 15);
  if (limited) return limited;
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "query required" }, { status: 400 });
  const { query, lat, lng } = body.data;

  const hiddenTypes = new Set(scenario.types.filter((t) => t.excludeFromSearch).map((t) => t.id));
  const live = await db
    .select()
    .from(resources)
    .where(gt(resources.updatedAt, new Date(Date.now() - scenario.expiryHours * 3600_000)))
    .orderBy(desc(resources.updatedAt))
    .limit(500);
  const rows: Row[] = live
    .filter((r) => !hiddenTypes.has(r.type))
    .map((r) => ({
      ...r,
      distanceKm: lat != null && lng != null ? distanceKm(lat, lng, r.lat, r.lng) : null,
    }));
  const byId = new Map(rows.map((r) => [r.id, r]));

  let ids: string[] = [];
  let answer = "";
  let skills: string[] = [];
  let plan: { text: string; resourceId?: string }[] = [];

  const ai = getGemini();
  if (ai) {
    try {
      const catalog = rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        description: r.description,
        skills: r.skills,
        status: r.status,
        distanceKm: r.distanceKm == null ? undefined : Number(r.distanceKm.toFixed(1)),
        confirmations: r.confirmations,
      }));
      const res = await generate(ai, {
        model: GEMINI_MODEL,
        contents:
          `Context: ${scenario.aiContext}.\n` +
          `A person describes their situation. Help them find a realistic next step from the listings.\n` +
          `Valid types: ${typeIds.join(", ")}. Valid statuses: ${statusIds.join(", ")}.\n\n` +
          `Return:\n` +
          `- skills: 3-6 transferable skills implied by their background (short phrases).\n` +
          `- ids: up to 8 listing ids that best fit them, best first. Match on skills, prefer open over ` +
          `closed, closer, and well-confirmed. Avoid "depleted" unless nothing else fits.\n` +
          `- plan: 2-4 short, concrete steps. Tie a step to a listing via resourceId when it uses one ` +
          `(otherwise empty string). Where it fits, include a step that builds AI literacy so they can ` +
          `work alongside AI tools.\n` +
          `- answer: ONE encouraging sentence (say plainly if nothing fits).\n` +
          `Use only ids from the list. Never invent listings, pay or requirements.\n\n` +
          `Person: "${query}"\n\nListings: ${JSON.stringify(catalog)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              ids: { type: Type.ARRAY, items: { type: Type.STRING } },
              plan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { text: { type: Type.STRING }, resourceId: { type: Type.STRING } },
                  required: ["text", "resourceId"],
                },
              },
              answer: { type: Type.STRING },
            },
            required: ["skills", "ids", "plan", "answer"],
          },
        },
      });
      const parsed = JSON.parse(res.text ?? "{}");
      ids = (parsed.ids ?? []).filter((id: string) => byId.has(id));
      answer = parsed.answer ?? "";
      skills = (parsed.skills ?? []).slice(0, 8);
      plan = (parsed.plan ?? []).slice(0, 5).map((p: { text: string; resourceId?: string }) => ({
        text: p.text,
        resourceId: p.resourceId && byId.has(p.resourceId) ? p.resourceId : undefined,
      }));
      // Anything the plan points at must also be a highlighted result
      for (const p of plan) if (p.resourceId && !ids.includes(p.resourceId)) ids.push(p.resourceId);
    } catch (e) {
      console.error(e);
    }
  }

  if (!ai || (!answer && ids.length === 0)) {
    ids = keywordMatch(query, rows).slice(0, 8);
    answer = ids.length
      ? "AI search is unavailable, so these are keyword matches."
      : "No matching opportunities found.";
    skills = [];
    plan = [];
  }

  return Response.json({ answer, skills, plan, results: ids.map((id) => byId.get(id)!) });
}
