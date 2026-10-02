import Link from "next/link";
import { Eye, Wallet } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader, TableWrap, Th, Td } from "@/components/admin/ui";
import { formatPrice } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { PaymentRow, OrderRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function PaymentsQueuePage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const searchParams = await _searchParams;
  const { admin } = await adminPageContext("payments.verify");
  const showAll = searchParams.all === "1";

  const { data: payments } = await admin
    .from("payments")
    .select("*")
    .eq("status", showAll ? "paid" : "awaiting_verification")
    .order("created_at", { ascending: false })
    .limit(100);

  const orderIds = ((payments ?? []) as PaymentRow[]).map((p) => p.order_id);
  const { data: orders } = orderIds.length
    ? await admin.from("orders").select("id, order_number, customer_name, customer_phone, grand_total_amount").in("id", orderIds)
    : { data: [] };
  const orderMap = new Map(((orders ?? []) as Pick<OrderRow, "id" | "order_number" | "customer_name" | "customer_phone" | "grand_total_amount">[]).map((o) => [o.id, o]));

  return (
    <div>
      <AdminHeader
        title="دفعات قيد المراجعة"
        subtitle={showAll ? "أحدث الدفعات المؤكدة" : "إثابات التحويل بانتظار التأكيد اليدوي"}
        action={
          <Link href={showAll ? "/admin/payments" : "/admin/payments?all=1"} className="btn-outline btn-sm">
            <Wallet className="h-4 w-4" /> {showAll ? "قيد المراجعة" : "المؤكدة سابقًا"}
          </Link>
        }
      />

      <div className="hidden md:block">
        <TableWrap>
          <thead>
            <tr>
              <Th>الطلب</Th>
              <Th>العميل</Th>
              <Th>الطريقة</Th>
              <Th>المبلغ</Th>
              <Th>رقم العملية</Th>
              <Th>الإيصال</Th>
              <Th>التاريخ</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {((payments ?? []) as PaymentRow[]).map((p) => {
              const o = orderMap.get(p.order_id);
              return (
                <tr key={p.id}>
                  <Td className="font-bold" dir="ltr">{o?.order_number ?? "—"}</Td>
                  <Td>
                    <p className="font-semibold">{o?.customer_name}</p>
                    <p className="text-2xs text-ink-400" dir="ltr">{o?.customer_phone}</p>
                  </Td>
                  <Td className="text-xs">{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS]?.labelAr}</Td>
                  <Td className="font-extrabold">{formatPrice(p.amount)}</Td>
                  <Td className="font-mono text-2xs" dir="ltr">{p.reference ?? "—"}</Td>
                  <Td className="text-xs">{p.receipt_path ? "مرفق" : "—"}</Td>
                  <Td className="text-2xs whitespace-nowrap">
                    {new Date(p.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                  </Td>
                  <Td>
                    <Link href={`/admin/orders/${p.order_id}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50">
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
        {((payments ?? []) as PaymentRow[]).map((p) => {
          const o = orderMap.get(p.order_id);
          return (
            <Link key={p.id} href={`/admin/orders/${p.order_id}`} className="card-pad block">
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold" dir="ltr">{o?.order_number}</span>
                <span className="text-sm font-extrabold">{formatPrice(p.amount)}</span>
              </div>
              <p className="mt-1 text-2xs text-ink-500">{o?.customer_name} — {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS]?.labelAr}</p>
              {p.reference && <p className="mt-0.5 font-mono text-2xs" dir="ltr">{p.reference}</p>}
            </Link>
          );
        })}
        {payments?.length === 0 && <p className="card-pad text-center text-sm text-ink-400">لا توجد دفعات للعرض.</p>}
      </div>
    </div>
  );
}
