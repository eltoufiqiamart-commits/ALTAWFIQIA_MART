import { BarChart3, TrendingUp, Search, Package } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader, StatCard } from "@/components/admin/ui";
import { formatPrice } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { OrderRow } from "@/types/database";

export const dynamic = "force-dynamic";

const REVENUE_STATUSES = new Set(["confirmed", "processing", "ready_for_shipment", "shipped", "out_for_delivery", "delivered"]);

export default async function AnalyticsPage() {
  const { admin } = await adminPageContext("analytics.view");
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [{ data: orders }, { data: searches }] = await Promise.all([
    admin
      .from("orders")
      .select("*")
      .gte("placed_at", since.toISOString())
      .order("placed_at", { ascending: false })
      .limit(2000),
    admin
      .from("search_logs")
      .select("term, results_count, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const orderRows = (orders ?? []) as OrderRow[];
  const paid = orderRows.filter((o) => REVENUE_STATUSES.has(o.status) || o.payment_status === "paid");
  const statusById = new Map(orderRows.map((o) => [o.id, o.status]));

  const validOrderIds = orderRows
    .filter((o) => REVENUE_STATUSES.has(o.status))
    .map((o) => o.id)
    .slice(0, 2000);
  let recentItems: Array<{ sku: string; name_ar: string; quantity: number; line_total_amount: number; order_id: string }> = [];
  // Chunk to stay well within PostgREST URL-length limits.
  for (let i = 0; i < validOrderIds.length; i += 400) {
    const chunk = validOrderIds.slice(i, i + 400);
    const { data: items } = await admin
      .from("order_items")
      .select("sku, name_ar, quantity, line_total_amount, order_id")
      .in("order_id", chunk);
    recentItems.push(...((items ?? []) as typeof recentItems));
  }
  void statusById;
  const revenue = paid.reduce((s, o) => s + o.grand_total_amount, 0);
  const delivered = orderRows.filter((o) => o.status === "delivered");
  const aov = paid.length ? Math.round(revenue / paid.length) : 0;

  // Revenue per day (simple inline bars).
  const byDay = new Map<string, number>();
  for (const o of paid) {
    const key = new Date(o.placed_at).toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + o.grand_total_amount);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxDay = Math.max(1, ...days.map(([, v]) => v));

  // Payment method split.
  const byMethod = new Map<string, { count: number; total: number }>();
  for (const o of orderRows) {
    const cur = byMethod.get(o.payment_method) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += o.grand_total_amount;
    byMethod.set(o.payment_method, cur);
  }

  // Governorate split.
  const byGov = new Map<string, number>();
  for (const o of orderRows) {
    const gov = (o.address_snapshot as { governorate?: string })?.governorate ?? "غير محدد";
    byGov.set(gov, (byGov.get(gov) ?? 0) + 1);
  }
  const govs = [...byGov.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  // Top products by quantity/value (only items belonging to valid orders).
  const productAgg = new Map<string, { name: string; qty: number; total: number }>();
  for (const it of recentItems) {
    const cur = productAgg.get(it.sku) ?? { name: it.name_ar, qty: 0, total: 0 };
    cur.qty += it.quantity;
    cur.total += it.line_total_amount;
    productAgg.set(it.sku, cur);
  }
  const topProducts = [...productAgg.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);

  // Top searches.
  const termAgg = new Map<string, { count: number; zero: number }>();
  for (const s of (searches ?? []) as Array<{ term: string; results_count: number }>) {
    const t = s.term.trim();
    if (!t) continue;
    const cur = termAgg.get(t) ?? { count: 0, zero: 0 };
    cur.count += 1;
    if (s.results_count === 0) cur.zero += 1;
    termAgg.set(t, cur);
  }
  const topSearches = [...termAgg.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15);
  const zeroSearches = [...termAgg.entries()].filter(([, v]) => v.zero > 0).sort((a, b) => b[1].zero - a[1].zero).slice(0, 10);

  return (
    <div className="space-y-5">
      <AdminHeader title="التحليلات" subtitle="آخر 30 يومًا — الأرقام المالية تشمل الطلبات غير الملغاة" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="إيراد 30 يومًا" value={formatPrice(revenue)} icon={TrendingUp} tone="success" />
        <StatCard label="طلبات 30 يومًا" value={orderRows.length} icon={BarChart3} tone="brand" />
        <StatCard label="متوسط قيمة الطلب" value={formatPrice(aov)} icon={Package} tone="accent" />
        <StatCard label="طلبات مسلّمة" value={delivered.length} icon={Package} tone="brand" />
      </div>

      <section className="card-pad">
        <h3 className="mb-3 text-sm font-extrabold">الإيراد اليومي</h3>
        <div className="flex h-40 items-end gap-1 overflow-x-auto">
          {days.map(([d, v]) => (
            <div key={d} className="flex min-w-5 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-bold text-ink-500">{Math.round(v / 100)}</span>
              <span className="w-full min-w-4 rounded-t bg-brand-500" style={{ height: `${Math.max(3, (v / maxDay) * 100)}%` }} title={formatPrice(v)} />
              <span className="text-[9px] text-ink-400">{d.slice(8)}</span>
            </div>
          ))}
          {days.length === 0 && <p className="w-full py-10 text-center text-xs text-ink-400">لا توجد مبيعات في الفترة.</p>}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-pad">
          <h3 className="mb-2 text-sm font-extrabold">الطلبات حسب طريقة الدفع</h3>
          <ul className="space-y-1.5 text-xs">
            {[...byMethod.entries()].map(([m, v]) => (
              <li key={m} className="flex items-center justify-between border-b border-ink-100 pb-1.5">
                <span className="font-semibold">{PAYMENT_METHODS[m as keyof typeof PAYMENT_METHODS]?.labelAr ?? m}</span>
                <span className="text-ink-500">{v.count} طلب — <b className="text-ink-800">{formatPrice(v.total)}</b></span>
              </li>
            ))}
            {byMethod.size === 0 && <li className="text-ink-400">لا بيانات.</li>}
          </ul>
        </section>

        <section className="card-pad">
          <h3 className="mb-2 text-sm font-extrabold">المحافظات الأكثر طلبًا</h3>
          <ul className="space-y-1.5 text-xs">
            {govs.map(([g, n]) => (
              <li key={g} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate font-semibold">{g}</span>
                <span className="h-2.5 rounded-full bg-brand-500" style={{ width: `${(n / Math.max(1, govs[0][1])) * 100}%` }} />
                <span className="text-ink-500">{n}</span>
              </li>
            ))}
            {govs.length === 0 && <li className="text-ink-400">لا بيانات.</li>}
          </ul>
        </section>

        <section className="card-pad">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold"><Package className="h-4 w-4" /> أكثر المنتجات مبيعًا</h3>
          <ul className="space-y-1.5 text-xs">
            {topProducts.map((p, i) => (
              <li key={i} className="flex items-center justify-between border-b border-ink-100 pb-1.5">
                <span className="truncate font-semibold">{p.name}</span>
                <span className="shrink-0 text-ink-500">{p.qty} قطعة — <b>{formatPrice(p.total)}</b></span>
              </li>
            ))}
            {topProducts.length === 0 && <li className="text-ink-400">لا بيانات.</li>}
          </ul>
        </section>

        <section className="card-pad">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold"><Search className="h-4 w-4" /> أكثر عبارات البحث</h3>
          <ul className="space-y-1.5 text-xs">
            {topSearches.map(([t, v]) => (
              <li key={t} className="flex items-center justify-between border-b border-ink-100 pb-1.5">
                <span className="font-semibold" dir="auto">{t}</span>
                <span className="text-ink-500">{v.count} بحث {v.zero > 0 && <b className="text-danger">({v.zero} بلا نتائج)</b>}</span>
              </li>
            ))}
            {topSearches.length === 0 && <li className="text-ink-400">لا عمليات بحث.</li>}
          </ul>
          {zeroSearches.length > 0 && (
            <div className="mt-3 rounded-xl bg-warningBg p-2">
              <p className="mb-1 text-2xs font-extrabold text-warning">عبارات بلا نتائج (فرص محتملة للتوفير):</p>
              <p className="text-2xs text-amber-900">{zeroSearches.map(([t]) => t).join("، ")}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
