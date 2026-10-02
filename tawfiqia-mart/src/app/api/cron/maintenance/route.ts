import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Scheduled maintenance endpoint, invoked by Vercel Cron (daily) or manually:
 *   GET /api/cron/maintenance
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when the
 * CRON_SECRET environment variable is configured. A `?key=` fallback exists
 * for manual ops only. The endpoint:
 *   1. cancels prepaid orders left unpaid past the 24h window (releases stock)
 *   2. purges rate-limit rows older than 7 days
 * Database functions self-enforce service-role-only access.
 */
function timingSafeMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET_NOT_CONFIGURED" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const authHeader = request.headers.get("authorization");
  const provided = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : request.nextUrl.searchParams.get("key");

  if (!provided || !timingSafeMatch(provided, secret)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const admin = createAdminClient();

    const { data: expired, error: expError } = await admin.rpc(
      "expire_stale_orders",
      { p_hours: 24 },
    );
    if (expError) throw new Error(expError.message);

    const { data: purged, error: purgeError } = await admin.rpc(
      "purge_old_rate_events",
      { p_days: 7 },
    );
    if (purgeError) throw new Error(purgeError.message);

    // Bounded rate-limit counter retention (migration 0021).
    const { data: cleaned } = await admin.rpc("cleanup_rate_limits");

    // Storage lifecycle (migration 0023, sections 10/11): collect uploads that
    // were never attached to a payment or product image. The RPC only returns
    // objects that are past the 48h grace period AND still unreferenced, so a
    // live receipt or catalog image can never be selected here.
    let orphansRemoved = 0;
    try {
      const { data: orphans } = await admin.rpc("list_orphan_objects", {
        p_grace_hours: 48,
        p_limit: 200,
      });
      const rows = (orphans ?? []) as Array<{ bucket: string; path: string }>;
      if (rows.length) {
        const byBucket = new Map<string, string[]>();
        for (const r of rows) {
          byBucket.set(r.bucket, [...(byBucket.get(r.bucket) ?? []), r.path]);
        }
        const deleted: string[] = [];
        for (const [bucket, paths] of byBucket) {
          const { error: rmError } = await admin.storage.from(bucket).remove(paths);
          // Only forget the ledger row once the object is actually gone.
          if (!rmError) deleted.push(...paths);
        }
        if (deleted.length) {
          await admin.rpc("forget_pending_objects", { p_paths: deleted });
          orphansRemoved = deleted.length;
        }
      }
    } catch (storageErr) {
      // Storage cleanup is best-effort; it must never fail the whole job.
      console.error("[cron/maintenance] orphan sweep", storageErr);
    }

    return NextResponse.json(
      {
        ok: true,
        ranAt: new Date().toISOString(),
        expiredOrders: (expired as { expired?: number } | null)?.expired ?? 0,
        ...(purged as { purgedRateEvents?: number } | null),
        rateLimitRowsPurged:
          (cleaned as { counters?: number } | null)?.counters ?? 0,
        orphanObjectsRemoved: orphansRemoved,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[cron/maintenance]", err);
    return NextResponse.json(
      { ok: false, error: "MAINTENANCE_FAILED" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
