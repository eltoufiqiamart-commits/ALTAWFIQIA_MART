import { NextResponse, type NextRequest } from "next/server";
import { getEnginesByModel, getModelsByMake } from "@/lib/server/catalog";
import { tryRateLimit } from "@/lib/server/rate-limit";

/** UUID guard: the ids come straight from the query string. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public vehicle hierarchy lookup (make -> model -> engine).
 *
 * Sections 8/25/40:
 *  - the payload is public, non-personalized reference data that changes rarely,
 *    so it may be cached by the shared CDN (s-maxage) instead of hitting the
 *    database on every dropdown change;
 *  - it is still rate limited, because it is an unauthenticated endpoint that
 *    triggers a database query;
 *  - ids are validated as UUIDs before they reach the data layer.
 */
const PUBLIC_CACHE = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET(request: NextRequest) {
  const makeId = request.nextUrl.searchParams.get("makeId");
  const modelId = request.nextUrl.searchParams.get("modelId");

  if ((makeId && !UUID_RE.test(makeId)) || (modelId && !UUID_RE.test(modelId))) {
    return NextResponse.json({ models: [], engines: [] }, { status: 400 });
  }

  const allowed = await tryRateLimit("vehicles");
  if (!allowed) {
    return NextResponse.json(
      { models: [], engines: [] },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    if (modelId) {
      const engines = await getEnginesByModel(modelId);
      return NextResponse.json({ engines }, { headers: PUBLIC_CACHE });
    }
    if (makeId) {
      const models = await getModelsByMake(makeId);
      return NextResponse.json({ models }, { headers: PUBLIC_CACHE });
    }
    return NextResponse.json({ models: [], engines: [] }, { headers: PUBLIC_CACHE });
  } catch {
    return NextResponse.json({ models: [], engines: [] }, { status: 200 });
  }
}
