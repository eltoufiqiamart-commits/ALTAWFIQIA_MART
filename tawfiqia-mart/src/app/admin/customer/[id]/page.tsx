import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader, TableWrap, Th, Td, StatusBadge } from "@/components/admin/ui";
import { RoleManager } from "@/components/admin/RoleManager";
import { ROLE_LABELS_AR } from "@/lib/permissions";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_AR, ORDER_STATUS_TONE, PAYMENT_STATUS_AR, PAYMENT_TONE } from "@/lib/orderStatus";
import type { OrderRow, OrderStatus, PaymentStatus, AddressRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params: _params }: { params: Promise<{ id: string }> }) {
  const params = await _params;
  const { user, admin } = await adminPageContext("customers.read");
  const { data: profile } = await admin.from("profiles").select("*").eq("id", params.id).maybeSingle();
  if (!profile) notFound();
  const p = profile as typeof profile & {
    id: string; full_name: string; phone: string | null; role: never; is_active: boolean;
    created_at: string; last_login_at: string | null;
  };

  const [{ data: orders }, { data: addresses }] = await Promise.all([
    admin.from("orders").select("*").eq("user_id", params.id).order("placed_at", { ascending: false }),
    admin.from("addresses").select("*").eq("user_id", params.id).order("is_default", { ascending: false }),
  ]);
  const orderRows = (orders ?? []) as OrderRow[];
  const totalPaid = orderRows
    .filter((o) => !["cancelled"].includes(o.status))
    .reduce((s, o) => s + o.grand_total_amount, 0);

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-2xs text-ink-400">
        <Link href="/admin/customers" className="hover:text-brand-700">العملاء</Link>
        <ChevronRight className="h-3 w-3" />
        <span>{p.full_name}</span>
      </nav>

      <AdminHeader title={p.full_name || "عميل"} subtitle={`عضو منذ ${new Date(p.created_at).toLocaleDateString("ar-EG", { dateStyle: "medium" })}`}>
        <div className="flex items-center gap-2">
          <StatusBadge tone={p.is_active ? "success" : "danger"}>{p.is_active ? "نشط" : "موقوف"}</StatusBadge>
          {user.profile.role === "super_admin" && p.id !== user.profile.id && (
            <RoleManager userId={p.id} role={p.role} active={p.is_active} />
          )}
        </div>
      </AdminHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-pad">
          <p className="text-2xs text-ink-500">عدد الطلبات</p>
          <p className="text-xl font-extrabold">{orderRows.length}</p>
        </div>
        <div className="card-pad">
          <p className="text-2xs text-ink-500">إجمالي المشتريات</p>
          <p className="text-xl font-extrabold">{formatPrice(totalPaid)}</p>
        </div>
        <div className="card-pad">
          <p className="text-2xs text-ink-500">الدور / آخر دخول</p>
          <p className="text-sm font-bold">{ROLE_LABELS_AR[p.role as never]}</p>
          <p className="text-2xs text-ink-400">{p.last_login_at ? new Date(p.last_login_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" }) : "—"}</p>
        </div>
      </div>

      <div className="card-pad">
        <h3 className="mb-2 text-sm font-extrabold">العناوين</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {((addresses ?? []) as AddressRow[]).map((a) => (
            <div key={a.id} className="rounded-xl border border-ink-100 p-3 text-xs">
              <p className="font-bold">{a.full_name} {a.is_default && <span className="badge-brand me-1">افتراضي</span>}</p>
              <p className="text-ink-600">{[a.governorate, a.city, a.area, a.street].filter(Boolean).join("، ")}</p>
              <p dir="ltr" className="text-2xs text-ink-400">{a.phone}</p>
            </div>
          ))}
          {(addresses?.length ?? 0) === 0 && <p className="text-2xs text-ink-400">لا توجد عناوين محفوظة.</p>}
        </div>
      </div>

      <div className="hidden md:block">
        <TableWrap>
          <thead>
            <tr>
              <Th>رقم الطلب</Th><Th>التاريخ</Th><Th>الحالة</Th><Th>الدفع</Th><Th>الإجمالي</Th>
            </tr>
          </thead>
          <tbody>
            {orderRows.map((o) => (
              <tr key={o.id} className="hover:bg-ink-50">
                <Td><Link href={`/admin/orders/${o.id}`} className="font-bold text-brand-700" dir="ltr">{o.order_number}</Link></Td>
                <Td className="text-2xs whitespace-nowrap">{new Date(o.placed_at).toLocaleDateString("ar-EG", { dateStyle: "short" })}</Td>
                <Td><StatusBadge tone={ORDER_STATUS_TONE[o.status as OrderStatus]}>{ORDER_STATUS_AR[o.status as OrderStatus]}</StatusBadge></Td>
                <Td><StatusBadge tone={PAYMENT_TONE[o.payment_status as PaymentStatus]}>{PAYMENT_STATUS_AR[o.payment_status as PaymentStatus]}</StatusBadge></Td>
                <Td className="font-extrabold">{formatPrice(o.grand_total_amount)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      <div className="space-y-2 md:hidden">
        {orderRows.map((o) => (
          <Link key={o.id} href={`/admin/orders/${o.id}`} className="card-pad flex items-center justify-between">
            <div>
              <p className="text-sm font-extrabold" dir="ltr">{o.order_number}</p>
              <p className="text-2xs text-ink-400">{new Date(o.placed_at).toLocaleDateString("ar-EG", { dateStyle: "short" })}</p>
            </div>
            <span className="text-sm font-bold">{formatPrice(o.grand_total_amount)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
