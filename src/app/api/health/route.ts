import { connection } from "next/server";

/**
 * A tiny check that the site and the database are both up. A scheduled GitHub job calls it every few days,
 * which also counts as activity so a free Supabase project doesn't get paused for being idle.
 * It reads one public row and returns nothing about it.
 */
export async function GET() {
  await connection();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ ok: true, database: "not configured (demo mode)" });
  try {
    const res = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return Response.json({ ok: res.ok, database: res.ok ? "up" : `error ${res.status}` }, { status: res.ok ? 200 : 503 });
  } catch {
    return Response.json({ ok: false, database: "unreachable" }, { status: 503 });
  }
}
