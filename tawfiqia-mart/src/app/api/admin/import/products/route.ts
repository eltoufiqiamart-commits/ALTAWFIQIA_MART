import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCsv, CsvTooLargeError } from "@/lib/server/csv";
import { egpToPiastres } from "@/lib/money";
import { slugify } from "@/lib/arabic";
import { roleCan } from "@/lib/permissions";
import { arabicError } from "@/lib/server/errors";

export const dynamic = "force-dynamic";
const MAX_ROWS = 1000;

interface ImportResult {
  created: number;
  updated: number;
  errors: Array<{ row: number; error: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("products.write");
    // Section 24: bulk import is the single most expensive admin operation.
    await enforceRateLimit("adminImport", user.id);
    const includeCost = roleCan(user.profile.role, "products.cost.view");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "FILE_INVALID" }, { status: 400 });
    }
    if (!/\.csv$/i.test(file.name)) {
      return NextResponse.json({ error: "FILE_INVALID" }, { status: 400 });
    }
    // Reject oversized uploads before buffering/parsing (platform body caps
    // aside, this keeps import memory bounded on every host).
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "CSV_TOO_LARGE" }, { status: 400 });
    }
    const text = await file.text();
    let records: Array<Record<string, string>>;
    try {
      records = parseCsv(text);
    } catch (err) {
      if (err instanceof CsvTooLargeError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
    if (records.length === 0) {
      return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
    }
    if (records.length > MAX_ROWS) {
      return NextResponse.json({ error: "TOO_MANY_ROWS" }, { status: 400 });
    }

    const admin = createAdminClient();
    const [{ data: cats }, { data: brandsData }] = await Promise.all([
      admin.from("categories").select("id, name_ar").is("deleted_at", null),
      admin.from("brands").select("id, name_ar").is("deleted_at", null),
    ]);
    const catMap = new Map((cats ?? []).map((c) => [c.name_ar.trim(), c.id]));
    const brandMap = new Map((brandsData ?? []).map((b) => [b.name_ar.trim(), b.id]));

    const { data: existing } = await admin.from("products").select("id, sku").in(
      "sku",
      records.map((r) => r.sku?.trim()).filter(Boolean),
    );
    const existingBySku = new Map((existing ?? []).map((p) => [p.sku, p.id]));

    const result: ImportResult = { created: 0, updated: 0, errors: [] };

    for (let i = 0; i < records.length; i++) {
      const rowNum = i + 2; // header is row 1
      const r = records[i];
      try {
        const sku = r.sku?.trim();
        const nameAr = r.name_ar?.trim();
        if (!sku || !nameAr) {
          result.errors.push({ row: rowNum, error: "sku و name_ar إجباريان" });
          continue;
        }
        const price = Number(r.price_egp ?? r.price);
        if (!Number.isFinite(price) || price < 0) {
          result.errors.push({ row: rowNum, error: "السعر غير صحيح" });
          continue;
        }
        const status = ["published", "draft", "archived"].includes(r.status) ? r.status : "draft";
        const condition = ["new", "genuine", "aftermarket"].includes(r.condition) ? r.condition : "new";
        const categoryName = r.category?.trim();
        const brandName = r.brand?.trim();
        if (categoryName && !catMap.has(categoryName)) {
          result.errors.push({ row: rowNum, error: `القسم غير موجود: ${categoryName}` });
          continue;
        }
        if (brandName && !brandMap.has(brandName)) {
          result.errors.push({ row: rowNum, error: `الماركة غير موجودة: ${brandName}` });
          continue;
        }

        const payload = {
          name_ar: nameAr,
          name_en: r.name_en?.trim() ?? "",
          sku,
          category_id: categoryName ? catMap.get(categoryName)! : null,
          brand_id: brandName ? brandMap.get(brandName)! : null,
          price_amount: egpToPiastres(price),
          discount_percent: Math.min(90, Math.max(0, Number(r.discount_percent ?? 0) || 0)),
          low_stock_threshold: Math.max(0, Math.trunc(Number(r.low_stock_threshold ?? 5) || 5)),
          status,
          condition,
          oem_number: r.oem_number?.trim() ?? "",
          part_number: r.part_number?.trim() ?? "",
          warranty: r.warranty?.trim() ?? "",
          is_featured: ["1", "true", "نعم", "yes"].includes((r.is_featured ?? "").trim().toLowerCase()),
          is_returnable: r.is_returnable === undefined ? true : ["1", "true", "نعم", "yes"].includes(r.is_returnable.trim().toLowerCase()),
          short_description: r.short_description?.trim() ?? "",
          ...(includeCost && r.cost_egp !== undefined
            ? { cost_amount: egpToPiastres(Math.max(0, Number(r.cost_egp) || 0)) }
            : {}),
        };
        // Stock of EXISTING products is never overwritten (would break the
        // stock >= reserved invariant). Use the inventory console for deltas.
        const initialStock = Math.max(0, Math.trunc(Number(r.stock_quantity ?? r.stock ?? 0) || 0));

        const existingId = existingBySku.get(sku);
        if (existingId) {
          const { error } = await admin.from("products").update(payload).eq("id", existingId);
          if (error) throw new Error(error.message);
          result.updated += 1;
        } else {
          const slugBase = slugify(r.name_en?.trim() || nameAr).slice(0, 72) || `product-${Date.now().toString(36)}`;
          const { error } = await admin
            .from("products")
            .insert({
              ...payload,
              stock_quantity: initialStock,
              slug: `${slugBase}-${Math.random().toString(36).slice(2, 7)}`,
            });
          if (error) throw new Error(error.message);
          result.created += 1;
        }
      } catch (err) {
        // Section 41: never surface a raw Postgres/PostgREST message to the
        // admin UI. arabicError() maps known codes (e.g. MARGIN_BELOW_COST
        // from the 0024/0027 margin policy, DUPLICATE_SKU) to Arabic text and
        // falls back to a safe generic message, logging the detail server-side.
        result.errors.push({ row: rowNum, error: arabicError(err).slice(0, 160) });
      }
    }

    await admin.from("audit_logs").insert({
      actor_id: user.profile.id,
      actor_role: user.profile.role,
      action: "products.import",
      entity: "product",
      entity_id: null,
      metadata: { created: result.created, updated: result.updated, errors: result.errors.length },
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = String((err as Error)?.message);
    const status = msg === "AUTH_REQUIRED" ? 401 : 403;
    return NextResponse.json({ error: msg === "AUTH_REQUIRED" ? msg : "FORBIDDEN" }, { status });
  }
}
