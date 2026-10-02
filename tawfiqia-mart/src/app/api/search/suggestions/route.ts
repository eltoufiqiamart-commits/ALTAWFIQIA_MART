import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeArabic } from "@/lib/arabic";
import { tryRateLimit } from "@/lib/server/rate-limit";

/**
 * Server-side suggestion endpoint (spec 28/29). Bounded results; never returns
 * private columns.
 *
 * Rate limiting goes through `consume_rate_limit` (migration 0021): the limit
 * and window are owned by the database, not by this caller. Previously this
 * route passed its own p_limit/p_window_sec to `check_rate_limit`, an RPC that
 * was publicly executable — so any client could call it directly with a huge
 * limit and bypass the protection entirely.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 100) return NextResponse.json({ items: [] });

  const allowed = await tryRateLimit("suggestions");
  if (!allowed) {
    return NextResponse.json(
      { items: [] },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const sb = await createClient();
  const { data, error } = await sb.rpc("search_suggestions", {
    p_query: normalizeArabic(q),
    p_limit: 8,
  });
  if (error) return NextResponse.json({ items: [] }, { status: 200 });
  return NextResponse.json({ items: data ?? [] });
}
