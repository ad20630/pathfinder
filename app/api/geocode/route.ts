import type { NextRequest } from "next/server";

// GET /api/geocode?q=McDonald's, North Point Parkway, Alpharetta&lat=..&lng=..
//   -> { lat, lng, approximate }
// Uses OpenStreetMap Nominatim (free, no key). Policy: max 1 req/s and a real User-Agent.
// `approximate` is true when we could only match a street/area instead of the exact place.
// Swap this for another geocoder if you outgrow it.
const AREA_CLASSES = new Set(["highway", "boundary", "place", "landuse", "natural"]);

async function lookup(q: string, viewbox?: string) {
  const params = new URLSearchParams({ q, format: "json", limit: "1" });
  if (viewbox) params.set("viewbox", viewbox);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "crisis-resource-map-hackathon/0.1" },
  });
  if (!res.ok) throw new Error("geocoder unavailable");
  const [hit] = await res.json();
  return hit as { lat: string; lon: string; class: string } | undefined;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.slice(0, 200);
  if (!q) return Response.json({ error: "q required" }, { status: 400 });

  // Bias results toward the user's current map view (~0.5 degree box)
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const viewbox =
    sp.has("lat") && Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lng - 0.5},${lat + 0.5},${lng + 0.5},${lat - 0.5}`
      : undefined;

  try {
    let hit = await lookup(q, viewbox);
    let approximate = false;
    // Exact place not found: retry without the leading name (e.g. just the street)
    const parts = q.split(",").map((p) => p.trim());
    if (!hit && parts.length > 1) {
      hit = await lookup(parts.slice(1).join(", "), viewbox);
      approximate = true;
    }
    if (!hit) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      approximate: approximate || AREA_CLASSES.has(hit.class),
    });
  } catch {
    return Response.json({ error: "geocoder unavailable" }, { status: 502 });
  }
}
