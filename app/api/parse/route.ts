import { Type } from "@google/genai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { scenario, statusIds, typeIds } from "@/config/scenario";
import { GEMINI_MODEL, generate, getGemini } from "@/lib/gemini";
import { rateLimit } from "@/lib/rateLimit";

// POST { text } -> { type, title, description, status, skills, locationHint }
// The client geocodes `locationHint` (or uses the map click) to get coordinates.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "parse", 10);
  if (limited) return limited;
  const body = z
    .object({ text: z.string().min(1).max(1000) })
    .safeParse(await req.json().catch(() => null));
  if (!body.success)
    return Response.json({ error: "text required" }, { status: 400 });
  const ai = getGemini();
  if (!ai) {
    return Response.json({ error: "GEMINI_API_KEY not set" }, { status: 503 });
  }

  try {
    const res = await generate(ai, {
      model: GEMINI_MODEL,
      contents: `Extract a map marker from this post. Context: ${scenario.aiContext}. Pick the closest type; "skills" is a short comma-separated list of skills the job needs or the training teaches.\n\nPost: "${body.data.text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: typeIds },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            status: { type: Type.STRING, enum: statusIds },
            skills: { type: Type.STRING },
            locationHint: {
              type: Type.STRING,
              description:
                "Most specific searchable location in the post: business name with its correct official spelling (e.g. McDonald's, not Mcdonalds), then street, city, state. Never drop the business name. Empty if no location is mentioned.",
            },
          },
          required: ["type", "title", "description", "status", "skills", "locationHint"],
        },
      },
    });
    return Response.json(JSON.parse(res.text ?? "{}"));
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: "AI is busy or unavailable, fill the form manually" },
      { status: 502 },
    );
  }
}
