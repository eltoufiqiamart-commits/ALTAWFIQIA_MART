import Link from "next/link";
import { Eye } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader, TableWrap, Th, Td, StatusBadge } from "@/components/admin/ui";
import type { ReturnRow, OrderRow } from "@/types/database";

export const dynamic = "force-dynamic";

const RETURN_AR: Record<string, string> = {
  requested: "بانتظار المراجعة",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
  received: "تم الاستلام",
  refunded: "تم رد المبلغ",
  cancelled: "ملغي",
};
const RETURN_TONE: Record<string, "warning" | "success" | "danger" | "neutral" | "brand"> = {
  requested: "warning",
  approved: "brand",
  rejected: "danger",
  received: "brand",
  refunded: "success",
  cancelled: "neutral",
};

export default async function ReturnsAdminPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const searchParams = await _searchParams;
  const { admin } = await adminPageContext("returns.write");
  const status = searchParams.status ?? "open";
  const openStatuses = ["requested", "approved", "received"];

  let query = admin.from("returns").select("*").order("created_at", { ascending: false });
  if (status !== "all") {
    const list = status === "open" ? openStatuses : [status];
    query = query.in("status", list);
  }
  const { data: returns } = await query.limit(100);

  const rows = (returns ?? []) as ReturnRow[];
  const orderIds = rows.map((r) => r.order_id);
  const { data: orders } = orderIds.length
    ? await admin.from("orders").select("id, order_number, customer_name, grand_total_amount").in("id", orderIds)
    : { data: [] };
  const orderMap = new Map(((orders ?? []) as Pick<OrderRow, "id" | "order_number" | "customer_name" | "grand_total_amount">[]).map((o) => [o.id, o]));

  return (
    <div>
      <AdminHeader title="المرتجعات" subtitle="مهلة الإرجاع 14 يومًا من التسليم" />

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link href="/admin/returns" className={`btn-sm ${status === "open" ? "btn-primary" : "btn-outline"}`}>المفتوحة</Link>
        {Object.entries(RETURN_AR).map(([k, v]) => (
          <Link key={k} href={`/admin/returns?status=${k}`} className={`btn-sm ${status === k ? "btn-primary" : "btn-outline"}`}>
            {v}
          </Link>
        ))}
        <Link href="/admin/returns?status=all" className={`btn-sm ${status === "all" ? "btn-primary" : "btn-outline"}`}>الكل</Link>
      </div>

      <div className="hidden md:block">
        <TableWrap>
          <thead>
            <tr>
              <Th>الطلب</Th>
              <Th>العميل</Th>
              <Th>السبب</Th>
              <Th>الحالة</Th>
              <Th>التاريخ</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const o = orderMap.get(r.order_id);
              return (
                <tr key={r.id}>
                  <Td className="font-bold" dir="ltr">{o?.order_number ?? "—"}</Td>
                  <Td className="text-xs">{o?.customer_name}</Td>
                  <Td className="max-w-xs truncate text-2xs text-ink-600">{r.reason}</Td>
                  <Td><StatusBadge tone={RETURN_TONE[r.status]}>{RETURN_AR[r.status]}</StatusBadge></Td>
                  <Td className="text-2xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("ar-EG", { dateStyle: "short" })}
                  </Td>
                  <Td>
                    <Link href={`/admin/orders/${r.order_id}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50">
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((r) => {
          const o = orderMap.get(r.order_id);
          return (
            <Link key={r.id} href={`/admin/orders/${r.order_id}`} className="card-pad block">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold" dir="ltr">{o?.order_number}</span>
                <StatusBadge tone={RETURN_TONE[r.status]}>{RETURN_AR[r.status]}</StatusBadge>
              </div>
              <p className="mt-1 text-2xs text-ink-500">{o?.customer_name}</p>
              <p className="mt-1 line-clamp-2 text-2xs text-ink-600">{r.reason}</p>
            </Link>
          );
        })}
        {rows.length === 0 && <p className="card-pad text-center text-sm text-ink-400">لا توجد مرتجعات.</p>}
      </div>
    </div>
  );
}
