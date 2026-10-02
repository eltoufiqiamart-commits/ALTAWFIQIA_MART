import Link from "next/link";
import {
  ClipboardList,
  Banknote,
  Package,
  Users,
  AlertTriangle,
  Wallet,
  RotateCcw,
  TrendingUp,
  ChevronLeft,
  MessageSquare,
} from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { roleCan } from "@/lib/permissions";
import { AdminHeader, StatCard } from "@/components/admin/ui";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_AR, ORDER_STATUS_TONE } from "@/lib/orderStatus";
import type { OrderStatus } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const { user, admin } = await adminPageContext("dashboard.view");
  const canSeeCost = roleCan(user.profile.role, "products.cost.view");
  const canReadCustomers = roleCan(user.profile.role, "customers.read");
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const sinceToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const [
    { data: orders30 },
    { count: ordersToday },
    { count: pendingOrders },
    { count: pendingPayments },
    { count: productCount },
    { count: customerCount },
    { data: stockRows },
    { count: openReturns },
    { data: recent },
  ] = await Promise.all([
    admin.from("orders").select("grand_total_amount").neq("status", "cancelled").gte("placed_at", since30),
    admin.from("orders").select("id", { count: "exact", head: true }).gte("placed_at", sinceToday),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "confirmed"]),
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "awaiting_verification"),
    admin.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
    admin
      .from("products")
      .select("id, name_ar, sku, stock_quantity, reserved_quantity, low_stock_threshold")
      .is("deleted_at", null)
      .order("stock_quantity", { ascending: true })
      .limit(200),
    admin
      .from("returns")
      .select("id", { count: "exact", head: true })
      .in("status", ["requested", "approved", "received"]),
    admin
      .from("orders")
      .select("id, order_number, customer_name, status, payment_status, grand_total_amount, placed_at")
      .order("placed_at", { ascending: false })
      .limit(10),
  ]);

  const revenueTotal = (orders30 ?? []).reduce((s, o) => s + Number(o.grand_total_amount), 0);

  // Contact inbox count is visible only to roles that may read messages.
  let openMessages = 0;
  if (canReadCustomers) {
    const { count } = await admin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("is_handled", false);
    openMessages = count ?? 0;
  }

  // Profit for delivered orders in the last 30 days.
  //
  // Section 13 fix: this previously joined every historical line to the
  // CURRENT products.cost_amount, so changing a product's cost silently
  // rewrote the profit of orders that had already been delivered. It now reads
  // the immutable per-line snapshot captured at order time
  // (order_items.cost_amount_at_order, migration 0020) and only falls back to
  // the current cost for legacy rows created before that migration.
  // The extra products lookup is also gone — one query instead of two.
  let estimatedProfit = 0;
  let deliveredCount = 0;
  let profitUsesLegacyCost = false;
  if (canSeeCost) {
    const { data: deliveredItems } = await admin
      .from("order_items")
      .select(
        "quantity, line_total_amount, product_id, cost_amount_at_order, orders!inner(id, status, placed_at)",
      )
      .eq("orders.status", "delivered")
      .gte("orders.placed_at", since30)
      .limit(5000);

    const items = (deliveredItems ?? []) as Array<{
      quantity: number;
      line_total_amount: number;
      product_id: string | null;
      cost_amount_at_order: number | null;
    }>;

    // Legacy rows (pre-0020) have no snapshot; resolve those only.
    const legacyIds = [
      ...new Set(
        items.filter((i) => i.cost_amount_at_order === null).map((i) => i.product_id).filter(Boolean),
      ),
    ] as string[];
    let legacyCost = new Map<string, number>();
    if (legacyIds.length) {
      profitUsesLegacyCost = true;
      const { data: costs } = await admin
        .from("products")
        .select("id, cost_amount")
        .in("id", legacyIds);
      legacyCost = new Map((costs ?? []).map((c) => [c.id, Number(c.cost_amount)]));
    }

    for (const i of items) {
      const unitCost =
        i.cost_amount_at_order ?? legacyCost.get(i.product_id ?? "") ?? 0;
      estimatedProfit += Number(i.line_total_amount) - unitCost * Number(i.quantity);
    }
  }
  {
    const { count } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "delivered")
      .gte("placed_at", since30);
    deliveredCount = count ?? 0;
  }

  // Low-stock computed server-side from private columns.
  const lowStock = (stockRows ?? [])
    .filter((p) => Number(p.stock_quantity) - Number(p.reserved_quantity) <= Number(p.low_stock_threshold))
    .slice(0, 8);

  return (
    <div>
      <AdminHeader title="نظرة عامة" subtitle="ملخص أداء المتجر خلال آخر 30 يومًا" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Banknote} tone="success" label="مبيعات 30 يوم" value={formatPrice(revenueTotal)} />
        {canSeeCost ? (
          <StatCard
            icon={TrendingUp}
            tone="brand"
            label="الربح التقديري (مُسلَّم)"
            value={formatPrice(estimatedProfit)}
            hint={profitUsesLegacyCost ? "بعض الطلبات القديمة تستخدم التكلفة الحالية" : "تكلفة محفوظة وقت الطلب"}
          />
        ) : (
          <StatCard icon={TrendingUp} tone="brand" label="طلبات مسلّمة (30 يوم)" value={deliveredCount} />
        )}
        <StatCard icon={ClipboardList} tone="brand" label="طلبات اليوم" value={ordersToday ?? 0} hint={`${pendingOrders ?? 0} قيد المراجعة`} />
        <StatCard icon={Wallet} tone="warning" label="دفعات قيد المراجعة" value={pendingPayments ?? 0} />
        <StatCard icon={Package} label="المنتجات" value={productCount ?? 0} hint={`${lowStock.length} مخزون منخفض`} />
        <StatCard icon={Users} label="العملاء" value={customerCount ?? 0} />
        <StatCard icon={RotateCcw} tone="danger" label="مرتجعات مفتوحة" value={openReturns ?? 0} />
        <StatCard icon={AlertTriangle} tone={lowStock.length > 0 ? "danger" : "success"} label="تنبيهات المخزون" value={lowStock.length} />
        {canReadCustomers && (
          <a href="/admin/messages" className="block">
            <StatCard icon={MessageSquare} tone={openMessages > 0 ? "warning" : "brand"} label="رسائل تواصل جديدة" value={openMessages} />
          </a>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h2 className="font-extrabold text-ink-950">أحدث الطلبات</h2>
            <Link href="/admin/orders" className="flex items-center text-xs font-bold text-brand-700">
              الكل <ChevronLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-ink-100">
            {(recent ?? []).map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-ink-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink-900" dir="ltr">{o.order_number}</p>
                  <p className="truncate text-2xs text-ink-400">{o.customer_name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`badge-${ORDER_STATUS_TONE[o.status as OrderStatus]}`}>
                    {ORDER_STATUS_AR[o.status as OrderStatus]}
                  </span>
                  <span className="text-sm font-extrabold">{formatPrice(o.grand_total_amount)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h2 className="font-extrabold text-ink-950">مخزون منخفض</h2>
            <Link href="/admin/inventory" className="text-xs font-bold text-brand-700">إدارة المخزون</Link>
          </div>
          <div className="divide-y divide-ink-100">
            {lowStock.length === 0 && <p className="p-4 text-sm text-ink-500">لا تنبيهات مخزون.</p>}
            {lowStock.map((p) => (
              <Link key={p.id} href={`/admin/products/${p.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-ink-50">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-ink-900">{p.name_ar}</p>
                  <p className="text-2xs text-ink-400" dir="ltr">{p.sku}</p>
                </div>
                <span
                  className={`badge ${
                    Number(p.stock_quantity) - Number(p.reserved_quantity) <= 0
                      ? "badge-danger"
                      : "badge-warning"
                  }`}
                >
                  متاح {Math.max(0, Number(p.stock_quantity) - Number(p.reserved_quantity))}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {(pendingPayments ?? 0) > 0 && (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warningBg p-4 text-sm font-semibold text-warning">
          توجد {pendingPayments} دفعة بانتظار المراجعة — افتح صفحة الدفعات للتأكيد.
        </div>
      )}
    </div>
  );
}
