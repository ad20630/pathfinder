// Tiny in-memory fixed-window limiter. Per server instance, so it's best-effort on serverless,
// but enough to stop one client from burning the Gemini quota.
const hits = new Map<string, { count: number; resetAt: number }>();

/** Returns a 429 Response if `req` exceeded `limit` calls per `windowMs` for `bucket`, else null. */
export function rateLimit(req: Request, bucket: string, limit: number, windowMs = 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();

  if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);

  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (++entry.count > limit) {
    return Response.json({ error: "Too many requests, slow down a little." }, { status: 429 });
  }
  return null;
}
