import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/server/csv";
import { toEgpInput } from "@/lib/money";
import { roleCan } from "@/lib/permissions";
import { writeAudit } from "@/lib/server/admin/audit";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const user = await requirePermission("products.read");
    // Section 38: exports are bulk data-access, metered separately (6/10min).
    await enforceRateLimit("adminExport", user.id);
    const includeCost = roleCan(user.profile.role, "products.cost.view");
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("products")
      .select(
        `sku, name_ar, name_en, price_amount, ${includeCost ? "cost_amount, " : ""}
         discount_percent, stock_quantity, reserved_quantity, low_stock_threshold,
         status, condition, oem_number, part_number, warranty, is_featured, is_returnable,
         short_description, categories(name_ar), brands(name_ar), updated_at`,
      )
      .is("deleted_at", null)
      .order("sku")
      .limit(20000);
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((p) => {
      const row: Record<string, string | number> = {
        sku: p.sku,
        name_ar: p.name_ar,
        name_en: p.name_en,
        category: (p.categories as { name_ar?: string } | null)?.name_ar ?? "",
        brand: (p.brands as { name_ar?: string } | null)?.name_ar ?? "",
        price_egp: toEgpInput(p.price_amount),
        discount_percent: p.discount_percent,
        stock_quantity: p.stock_quantity,
        reserved_quantity: p.reserved_quantity,
        low_stock_threshold: p.low_stock_threshold,
        status: p.status,
        condition: p.condition,
        oem_number: p.oem_number,
        part_number: p.part_number,
        warranty: p.warranty,
        is_featured: p.is_featured ? 1 : 0,
        is_returnable: p.is_returnable ? 1 : 0,
        short_description: p.short_description,
      };
      if (includeCost) row.cost_egp = toEgpInput((p as { cost_amount?: number }).cost_amount ?? 0);
      return row;
    });

    await writeAudit(admin, { id: user.profile.id, role: user.profile.role },
      "export.products", "product", null, { rows: rows.length, includeCost });
    const csv = toCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tawfiqia-products-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status = String((err as Error)?.message) === "AUTH_REQUIRED" ? 401 : 403;
    return NextResponse.json({ error: "FORBIDDEN" }, { status });
  }
}
