import Link from "next/link";
import { Search, Eye, Download } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader, TableWrap, Th, Td } from "@/components/admin/ui";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_AR, ORDER_STATUS_TONE, PAYMENT_STATUS_AR, PAYMENT_TONE } from "@/lib/orderStatus";
import { EGYPTIAN_GOVERNORATES } from "@/lib/constants";
import { pagedHref } from "@/lib/admin-query";
import type { OrderStatus, PaymentStatus, OrderRow } from "@/types/database";

export const dynamic = "force-dynamic";
const PER = 25;

export default async function AdminOrdersPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; payment?: string; governorate?: string; page?: string }>;
}) {
  const searchParams = await _searchParams;
  const { admin } = await adminPageContext("orders.read");
  const q = (searchParams.q ?? "").trim();
  const status = searchParams.status ?? "";
  const payment = searchParams.payment ?? "";
  const governorate = searchParams.governorate ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);

  // Dynamic filters include a JSONB snapshot accessor; keep the builder loosely typed.
  let query: any = admin
    .from("orders")
    .select("*", { count: "exact" })
    .order("placed_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (payment) query = query.eq("payment_status", payment);
  if (governorate) query = query.eq("address_snapshot->>governorate", governorate);
  if (q) {
    const term = q.replace(/[%,]/g, "");
    query = query.or(
      `order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`,
    );
  }
  const from = (page - 1) * PER;
  const { data: orders, count } = await query.range(from, from + PER - 1);

  return (
    <div>
      <AdminHeader
        title="الطلبات"
        subtitle={`${count ?? 0} طلب`}
        action={
          <a
            className="btn-outline btn-sm"
            href={`/api/admin/export/orders?days=30${status ? `&status=${encodeURIComponent(status)}` : ""}${
              payment ? `&payment=${encodeURIComponent(payment)}` : ""
            }`}
          >
            <Download className="h-4 w-4" /> تصدير CSV (30 يوم)
          </a>
        }
      />

      <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative sm:col-span-2">
          <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input name="q" defaultValue={q} placeholder="رقم طلب / اسم / هاتف" className="input input-sm pe-9" />
        </div>
        <select name="status" defaultValue={status} className="input input-sm">
          <option value="">كل حالات الطلب</option>
          {Object.entries(ORDER_STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="payment" defaultValue={payment} className="input input-sm">
          <option value="">كل حالات الدفع</option>
          {Object.entries(PAYMENT_STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="governorate" defaultValue={governorate} className="input input-sm">
          <option value="">كل المحافظات</option>
          {EGYPTIAN_GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <button className="btn-outline btn-sm">تصفية</button>
      </form>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {((orders ?? []) as OrderRow[]).map((o) => (
          <Link key={o.id} href={`/admin/orders/${o.id}`} className="card-pad block">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold" dir="ltr">{o.order_number}</span>
              <span className={`badge-${ORDER_STATUS_TONE[o.status as OrderStatus]}`}>
                {ORDER_STATUS_AR[o.status as OrderStatus]}
              </span>
            </div>
            <p className="mt-1 text-2xs text-ink-500">
              {o.customer_name} — {(o.address_snapshot as { governorate?: string })?.governorate}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className={`badge-${PAYMENT_TONE[o.payment_status as PaymentStatus]}`}>
                {PAYMENT_STATUS_AR[o.payment_status as PaymentStatus]}
              </span>
              <span className="text-sm font-extrabold">{formatPrice(o.grand_total_amount)}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <TableWrap>
          <thead>
            <tr>
              <Th>رقم الطلب</Th>
              <Th>العميل</Th>
              <Th>المحافظة</Th>
              <Th>الحالة</Th>
              <Th>الدفع</Th>
              <Th>الإجمالي</Th>
              <Th>التاريخ</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {((orders ?? []) as OrderRow[]).map((o) => (
              <tr key={o.id} className="hover:bg-ink-50">
                <Td className="font-bold" dir="ltr">{o.order_number}</Td>
                <Td>
                  <p className="font-semibold">{o.customer_name}</p>
                  <p className="text-2xs text-ink-400" dir="ltr">{o.customer_phone}</p>
                </Td>
                <Td className="text-xs">{(o.address_snapshot as { governorate?: string })?.governorate}</Td>
                <Td>
                  <span className={`badge-${ORDER_STATUS_TONE[o.status as OrderStatus]}`}>
                    {ORDER_STATUS_AR[o.status as OrderStatus]}
                  </span>
                </Td>
                <Td>
                  <span className={`badge-${PAYMENT_TONE[o.payment_status as PaymentStatus]}`}>
                    {PAYMENT_STATUS_AR[o.payment_status as PaymentStatus]}
                  </span>
                </Td>
                <Td className="font-extrabold">{formatPrice(o.grand_total_amount)}</Td>
                <Td className="text-2xs whitespace-nowrap">
                  {new Date(o.placed_at).toLocaleDateString("ar-EG", { dateStyle: "short" })}
                </Td>
                <Td>
                  <Link href={`/admin/orders/${o.id}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50">
                    <Eye className="h-4 w-4" />
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs">
        {page > 1 && <Link href={pagedHref("/admin/orders", page - 1, searchParams)} className="btn-outline btn-sm">السابق</Link>}
        <span className="text-ink-500">صفحة {page} من {Math.ceil((count ?? 0) / PER)}</span>
        {page < Math.ceil((count ?? 0) / PER) && (
          <Link href={pagedHref("/admin/orders", page + 1, searchParams)} className="btn-outline btn-sm">التالي</Link>
        )}
      </div>
    </div>
  );
}
