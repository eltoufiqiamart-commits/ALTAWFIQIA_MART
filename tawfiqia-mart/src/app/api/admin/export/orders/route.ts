import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/server/csv";
import { toEgpInput } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/constants";
import { writeAudit } from "@/lib/server/admin/audit";

export const dynamic = "force-dynamic";

/**
 * Order-level CSV export (admin only). Financial fields are order totals only;
 * no cost/supplier columns are ever emitted here.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("orders.read");
    // Section 38: exports are bulk data-access, metered separately (6/10min)
    // from ordinary admin clicks so one staff account cannot drain the DB.
    await enforceRateLimit("adminExport", user.id);
    const admin = createAdminClient();

    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const payment = params.get("payment");
    const days = Math.min(366, Math.max(1, Number(params.get("days")) || 30));
    const since = new Date(Date.now() - days * 864e5).toISOString();

    // Loose typing for JSONB filter builders (same pattern as the orders list).
    let query: any = admin
      .from("orders")
      .select(
        "order_number, placed_at, status, payment_status, payment_method, customer_name, customer_phone, customer_email, address_snapshot, subtotal_amount, coupon_code, coupon_discount_amount, prepaid_discount_amount, shipping_amount, cod_fee_amount, grand_total_amount",
      )
      .gte("placed_at", since)
      .order("placed_at", { ascending: false })
      .limit(5000);
    if (status) query = query.eq("status", status);
    if (payment) query = query.eq("payment_status", payment);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((o: Record<string, unknown>) => {
      const addr = (o.address_snapshot ?? {}) as {
        governorate?: string; city?: string; address?: string;
      };
      return {
        order_number: o.order_number,
        placed_at: new Date(o.placed_at as string).toISOString(),
        status: o.status,
        payment_status: o.payment_status,
        payment_method:
          PAYMENT_METHODS[o.payment_method as keyof typeof PAYMENT_METHODS]?.labelAr ?? o.payment_method,
        customer_name: o.customer_name,
        customer_phone: o.customer_phone,
        customer_email: o.customer_email ?? "",
        governorate: addr.governorate ?? "",
        city: addr.city ?? "",
        address: addr.address ?? "",
        subtotal_egp: toEgpInput(Number(o.subtotal_amount)),
        coupon_code: o.coupon_code ?? "",
        coupon_discount_egp: toEgpInput(Number(o.coupon_discount_amount ?? 0)),
        prepaid_discount_egp: toEgpInput(Number(o.prepaid_discount_amount ?? 0)),
        shipping_egp: toEgpInput(Number(o.shipping_amount ?? 0)),
        cod_fee_egp: toEgpInput(Number(o.cod_fee_amount ?? 0)),
        grand_total_egp: toEgpInput(Number(o.grand_total_amount)),
      };
    });

    await writeAudit(admin, { id: user.profile.id, role: user.profile.role },
      "export.orders", "order", null, { days, status, payment, rows: rows.length });
    const csv = toCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tawfiqia-orders-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const statusCode = String((err as Error)?.message) === "AUTH_REQUIRED" ? 401 : 403;
    return NextResponse.json({ error: "FORBIDDEN" }, { status: statusCode });
  }
}
