import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader, TableWrap, Th, Td } from "@/components/admin/ui";
import { StockAdjust } from "@/components/admin/StockAdjust";
import { pagedHref } from "@/lib/admin-query";

export const dynamic = "force-dynamic";
const PER = 50;

export default async function InventoryPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string; page?: string }>;
}) {
  const searchParams = await _searchParams;
  const { admin } = await adminPageContext("inventory.write");
  const q = (searchParams.q ?? "").trim();
  const lowOnly = searchParams.low === "1";
  const page = Math.max(1, Number(searchParams.page) || 1);

  // Low stock is computed in SQL with reserved quantities.
  let query = admin
    .from("products")
    .select(
      "id, name_ar, sku, stock_quantity, reserved_quantity, low_stock_threshold, status, deleted_at, categories(name_ar)",
      { count: "exact" },
    )
    .order("stock_quantity", { ascending: true });
  if (q) {
    const term = q.replace(/[%,]/g, "");
    query = query.or(`name_ar.ilike.%${term}%,sku.ilike.%${term}%`);
  }
  const from = (page - 1) * PER;
  const { data: rows, count } = await query.range(from, from + PER - 1);

  interface StockRow {
    id: string;
    name_ar: string;
    sku: string;
    stock_quantity: number;
    reserved_quantity: number;
    low_stock_threshold: number;
    status: string;
    deleted_at: string | null;
    categories: { name_ar: string } | null;
  }
  const all = (rows ?? []) as unknown as StockRow[];
  const products = lowOnly
    ? all.filter((p) => p.stock_quantity - p.reserved_quantity <= p.low_stock_threshold && !p.deleted_at)
    : all.filter((p) => !p.deleted_at);

  const { data: txRows } = await admin
    .from("inventory_transactions")
    .select("id, product_id, change_quantity, reason, note, created_at, products(name_ar, sku)")
    .order("created_at", { ascending: false })
    .limit(15);
  const txList = (txRows ?? []) as Array<{
    id: string;
    change_quantity: number;
    reason: string;
    note: string;
    created_at: string;
    products: { name_ar: string; sku: string } | null;
  }>;
  const REASON_AR: Record<string, string> = {
    manual: "تسوية يدوية",
    order: "حجز طلب",
    restock: "توريد",
    return: "مرتجع",
    adjustment: "تسوية",
    cancel: "إلغاء طلب",
  };

  return (
    <div>
      <AdminHeader title="المخزون والتسويات" subtitle="كل التعديلات تتم عبر قيد ذرّي وتُسجَّل في سجل المخزون" />

      <form className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input name="q" defaultValue={q} placeholder="اسم المنتج أو SKU" className="input input-sm pe-9" />
        </div>
        <label className="flex items-center gap-1.5 text-xs font-semibold">
          <input type="checkbox" name="low" value="1" defaultChecked={lowOnly} className="h-4 w-4 accent-brand-600" />
          المنخفض فقط
        </label>
        <button className="btn-outline btn-sm">تصفية</button>
      </form>

      {lowOnly && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-warningBg px-3 py-2 text-xs font-bold text-warning">
          <AlertTriangle className="h-4 w-4" />
          {products.length} منتج عند أو تحت حد إعادة الطلب
        </div>
      )}

      <div className="hidden md:block">
        <TableWrap>
          <thead>
            <tr>
              <Th>المنتج</Th>
              <Th>القسم</Th>
              <Th>المخزون الكلي</Th>
              <Th>محجوز</Th>
              <Th>المتاح</Th>
              <Th>حد التنبيه</Th>
              <Th>تسوية</Th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const available = p.stock_quantity - p.reserved_quantity;
              const low = available <= p.low_stock_threshold;
              return (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/admin/products/${p.id}`} className="font-bold hover:text-brand-700">{p.name_ar}</Link>
                    <p className="text-2xs text-ink-400" dir="ltr">{p.sku}</p>
                  </Td>
                  <Td className="text-2xs">{p.categories?.name_ar ?? "—"}</Td>
                  <Td>{p.stock_quantity}</Td>
                  <Td className="text-ink-500">{p.reserved_quantity}</Td>
                  <Td>
                    <span className={`font-extrabold ${low ? "text-danger" : available === 0 ? "text-danger" : "text-success"}`}>
                      {Math.max(0, available)}
                    </span>
                  </Td>
                  <Td className="text-ink-500">{p.low_stock_threshold}</Td>
                  <Td>
                    <StockAdjust productId={p.id} available={Math.max(0, available)} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </div>

      {/* Mobile */}
      <div className="space-y-2 md:hidden">
        {products.map((p) => {
          const available = p.stock_quantity - p.reserved_quantity;
          const low = available <= p.low_stock_threshold;
          return (
            <div key={p.id} className="card-pad">
              <Link href={`/admin/products/${p.id}`} className="block">
                <p className="text-sm font-bold">{p.name_ar}</p>
                <p className="text-2xs text-ink-400" dir="ltr">{p.sku}</p>
              </Link>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span>متاح: <b className={low ? "text-danger" : "text-success"}>{Math.max(0, available)}</b></span>
                <span className="text-ink-400">كلي {p.stock_quantity} / محجوز {p.reserved_quantity}</span>
              </div>
              <div className="mt-2">
                <StockAdjust productId={p.id} available={Math.max(0, available)} />
              </div>
            </div>
          );
        })}
      </div>

      {!lowOnly && count && count > PER && (
        <div className="mt-4 flex justify-center gap-2 text-xs">
          {page > 1 && <Link href={pagedHref("/admin/inventory", page - 1, searchParams)} className="btn-outline btn-sm">السابق</Link>}
          <span className="py-1.5 text-ink-500">صفحة {page} من {Math.ceil(count / PER)}</span>
          {page < Math.ceil(count / PER) && (
            <Link href={pagedHref("/admin/inventory", page + 1, searchParams)} className="btn-outline btn-sm">التالي</Link>
          )}
        </div>
      )}

      <section className="card mt-6 overflow-hidden">
        <h2 className="border-b border-ink-100 px-4 py-3 text-sm font-extrabold">آخر حركات المخزون</h2>
        <ul className="divide-y divide-ink-100">
          {txList.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-2xs">
              <div className="min-w-0">
                <p className="truncate font-bold">{t.products?.name_ar ?? "منتج محذوف"}</p>
                <p className="text-ink-400" dir="ltr">{t.products?.sku ?? ""} {t.note ? `— ${t.note}` : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded bg-ink-100 px-1.5 py-0.5 font-semibold">{REASON_AR[t.reason] ?? t.reason}</span>
                <span className={`w-12 text-center font-extrabold ${t.change_quantity > 0 ? "text-success" : "text-danger"}`}>
                  {t.change_quantity > 0 ? "+" : ""}{t.change_quantity}
                </span>
                <span className="w-20 text-ink-400">
                  {new Date(t.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
            </li>
          ))}
          {txList.length === 0 && <li className="px-4 py-6 text-center text-ink-400">لا حركات بعد.</li>}
        </ul>
      </section>
    </div>
  );
}
