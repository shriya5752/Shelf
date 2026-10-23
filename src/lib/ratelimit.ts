/**
 * A small per-visitor limit for the API routes so nobody can burn through the TMDB quota.
 * It lives in server memory, so on serverless it is best-effort (each warm instance counts separately),
 * which is enough to stop casual abuse.
 */
const hits = new Map<string, { n: number; reset: number }>();

export function limited(request: Request, max = 90, windowMs = 60_000): Response | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "local";
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + windowMs });
    return null;
  }
  if (++h.n > max) {
    return Response.json({ results: [], error: "Too many requests. Try again in a minute." }, { status: 429, headers: { "Retry-After": String(Math.ceil((h.reset - now) / 1000)) } });
  }
  return null;
}
