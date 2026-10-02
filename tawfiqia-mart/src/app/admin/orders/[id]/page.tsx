import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ChevronRight, Phone, MapPin, FileText } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { roleCan } from "@/lib/permissions";
import { AdminHeader, StatusBadge } from "@/components/admin/ui";
import { OrderActionsPanel } from "@/components/admin/OrderActionsPanel";
import { formatPrice } from "@/lib/money";
import { imageUrl } from "@/lib/images";
import { signedPrivateUrl } from "@/lib/server/upload";
import {
  ORDER_STATUS_AR,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_AR,
  PAYMENT_TONE,
  FULFILLMENT_AR,
} from "@/lib/orderStatus";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { OrderStatus, PaymentStatus, FulfillmentStatus, OrderItemRow, PaymentRow, OrderStatusHistoryRow, ReturnRow, ProductRow, SupplierRow } from "@/types/database";

export const dynamic = "force-dynamic";

interface AddressSnap {
  fullName?: string;
  phone?: string;
  governorate?: string;
  city?: string;
  address?: string;
  notes?: string;
}

export default async function AdminOrderDetail({ params: _params }: { params: Promise<{ id: string }> }) {
  const params = await _params;
  const { user, admin } = await adminPageContext("orders.read");
  const canWriteOrders = roleCan(user.profile.role, "orders.write");
  const canVerifyPayments = roleCan(user.profile.role, "payments.verify");
  const canWriteReturns = roleCan(user.profile.role, "returns.write");
  // Two distinct private scopes: cost figures (products.cost.view) vs.
  // supplier identities/contacts (suppliers.read). Never collapse them.
  const canSeeCost = roleCan(user.profile.role, "products.cost.view");
  const canSeeSuppliers =
    canSeeCost || roleCan(user.profile.role, "suppliers.read");

  const { data: order } = await admin.from("orders").select("*").eq("id", params.id).maybeSingle();
  if (!order) notFound();

  const [{ data: items }, { data: payment }, { data: history }, { data: ret }, { data: supplier }] = await Promise.all([
    admin.from("order_items").select("*").eq("order_id", order.id),
    admin.from("payments").select("*").eq("order_id", order.id).maybeSingle(),
    admin.from("order_status_history").select("*").eq("order_id", order.id).order("created_at"),
    admin.from("returns").select("*").eq("order_id", order.id).maybeSingle(),
    order.supplier_id && canSeeSuppliers
      ? admin.from("suppliers").select("*").eq("id", order.supplier_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Sections 12 + 13: cost and supplier now come from the IMMUTABLE per-line
  // snapshot written at order time (migration 0020) instead of being re-joined
  // to the current product/supplier rows. This keeps historical orders correct
  // when a product's cost changes, its supplier changes, or the product is
  // archived/deleted — and removes 2-3 extra queries from this page.
  // Legacy rows (pre-0020) fall back to the current values so old orders still
  // render; that fallback is clearly labelled in the UI.
  type SnapshotItem = OrderItemRow & {
    cost_amount_at_order: number | null;
    supplier_id_at_order: string | null;
    supplier_name_at_order: string | null;
  };
  const itemRows = (items ?? []) as SnapshotItem[];

  let costByProduct = new Map<string, number>();
  let supplierNames: Map<string, string> | undefined;
  let usesLegacyJoin = false;

  if (canSeeCost) {
    for (const i of itemRows) {
      if (i.cost_amount_at_order !== null && i.product_id) {
        costByProduct.set(i.product_id, i.cost_amount_at_order);
      }
    }
    const legacyIds = itemRows
      .filter((i) => i.cost_amount_at_order === null && i.product_id)
      .map((i) => i.product_id) as string[];
    if (legacyIds.length) {
      usesLegacyJoin = true;
      const { data: costInfo } = await admin
        .from("products")
        .select("id, cost_amount")
        .in("id", [...new Set(legacyIds)]);
      for (const p of (costInfo ?? []) as Array<{ id: string; cost_amount: number }>) {
        costByProduct.set(p.id, p.cost_amount);
      }
    }
  }

  if (canSeeSuppliers) {
    const fromSnapshot = new Map<string, string>();
    for (const i of itemRows) {
      if (i.supplier_name_at_order && i.product_id) {
        fromSnapshot.set(i.product_id, i.supplier_name_at_order);
      }
    }
    const legacyIds = itemRows
      .filter((i) => !i.supplier_name_at_order && i.product_id)
      .map((i) => i.product_id) as string[];
    if (legacyIds.length) {
      usesLegacyJoin = true;
      const { data: linkInfo } = await admin
        .from("products")
        .select("id, supplier_id")
        .in("id", [...new Set(legacyIds)]);
      const rows = (linkInfo ?? []) as Array<{ id: string; supplier_id: string | null }>;
      const supplierIds = [...new Set(rows.map((p) => p.supplier_id).filter(Boolean))] as string[];
      if (supplierIds.length) {
        const { data: supRows } = await admin.from("suppliers").select("id, name").in("id", supplierIds);
        const supName = new Map(((supRows ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]));
        for (const p of rows) {
          fromSnapshot.set(p.id, p.supplier_id ? supName.get(p.supplier_id) ?? "" : "");
        }
      }
    }
    if (fromSnapshot.size) supplierNames = fromSnapshot;
  }

  const addr = order.address_snapshot as AddressSnap;
  // Receipts are private payment artifacts: only payment verifiers ever get
  // a signed URL for them (10-minute expiry). Other staff see the order but
  // never the proof-of-transfer file.
  let receiptUrl: string | null = null;
  if (canVerifyPayments && payment?.receipt_path) {
    try {
      receiptUrl = await signedPrivateUrl(payment.receipt_path);
    } catch {
      receiptUrl = null;
    }
  }

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-2xs text-ink-400">
        <Link href="/admin/orders" className="hover:text-brand-700">الطلبات</Link>
        <ChevronRight className="h-3 w-3" />
        <span dir="ltr">{order.order_number}</span>
      </nav>

      <AdminHeader
        title={`طلب ${order.order_number}`}
        subtitle={new Date(order.placed_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}
      >
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={ORDER_STATUS_TONE[order.status as OrderStatus]}>{ORDER_STATUS_AR[order.status as OrderStatus]}</StatusBadge>
          <StatusBadge tone={PAYMENT_TONE[order.payment_status as PaymentStatus]}>
            {PAYMENT_STATUS_AR[order.payment_status as PaymentStatus]}
          </StatusBadge>
        </div>
      </AdminHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Items */}
          <div className="card overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-ink-50 text-ink-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">القطعة</th>
                  <th className="px-3 py-2 font-semibold">سعر الوحدة</th>
                  <th className="px-3 py-2 font-semibold">الكمية</th>
                  <th className="px-3 py-2 font-semibold">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {((items ?? []) as OrderItemRow[]).map((it) => (
                  <tr key={it.id}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {it.image_url && (
                          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                            <Image src={imageUrl(it.image_url)} alt="" fill sizes="48px" className="object-contain p-1" />
                          </span>
                        )}
                        <div>
                          <p className="font-semibold leading-snug">{it.name_ar}</p>
                          <p className="text-2xs text-ink-400" dir="ltr">{it.sku}</p>
                          {canSeeSuppliers && it.product_id && supplierNames?.has(it.product_id) && (
                            <p className="mt-0.5 text-2xs text-ink-500">
                              المورّد: <span className="font-bold">{supplierNames.get(it.product_id) || "بلا مورّد"}</span>
                            </p>
                          )}
                          {canSeeCost && it.product_id && costByProduct.has(it.product_id) && (
                            <p className="mt-0.5 text-2xs text-ink-500">
                              التكلفة: <span className="font-bold">{formatPrice(costByProduct.get(it.product_id) ?? 0)}</span>
                              {it.cost_amount_at_order === null && (
                                <span className="font-bold text-accent-700"> (تقديرية)</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatPrice(it.unit_price_amount)}</td>
                    <td className="px-3 py-2">{it.quantity}</td>
                    <td className="px-3 py-2 font-extrabold whitespace-nowrap">{formatPrice(it.line_total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(canSeeCost || canSeeSuppliers) && usesLegacyJoin && (
            <p className="rounded-lg bg-accent-50 px-3 py-2 text-2xs font-bold text-accent-800">
              تنبيه: بعض بيانات التكلفة أو المورّد في هذا الطلب غير محفوظة كلقطة
              تاريخية (طلب أُنشئ قبل ترحيل 0020)، وتم جلبها من بيانات المنتج
              الحالية. قد تختلف عن القيم وقت تنفيذ الطلب.
            </p>
          )}

          {/* Totals */}
          <div className="card-pad space-y-1.5 text-xs">
            <Row label="المجموع الفرعي" value={formatPrice(order.subtotal_amount)} />
            {order.coupon_discount_amount > 0 && (
              <Row label={`كوبون ${order.coupon_code ?? ""}`} value={`− ${formatPrice(order.coupon_discount_amount)}`} />
            )}
            {order.prepaid_discount_amount > 0 && (
              <Row label="خصم الدفع المسبق" value={`− ${formatPrice(order.prepaid_discount_amount)}`} />
            )}
            <Row label="الشحن" value={order.shipping_amount > 0 ? formatPrice(order.shipping_amount) : "مجاني"} />
            {order.cod_fee_amount > 0 && <Row label="رسوم الدفع عند الاستلام (1%)" value={formatPrice(order.cod_fee_amount)} />}
            <div className="flex items-center justify-between border-t border-ink-100 pt-2 text-sm font-extrabold">
              <span>الإجمالي النهائي</span>
              <span>{formatPrice(order.grand_total_amount)}</span>
            </div>
          </div>

          {/* History */}
          <div className="card-pad">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold">
              <FileText className="h-4 w-4 text-brand-600" /> سجل الحالة
            </h3>
            <ol className="space-y-2 border-r-2 border-ink-100 pr-3 text-xs">
              {((history ?? []) as OrderStatusHistoryRow[]).map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -right-[1.45rem] top-1 h-2 w-2 rounded-full bg-brand-500" />
                  <p className="font-semibold">
                    {h.from_status ? `${ORDER_STATUS_AR[h.from_status as OrderStatus] ?? h.from_status} ← ` : ""}
                    {ORDER_STATUS_AR[h.to_status as OrderStatus] ?? h.to_status}
                  </p>
                  {h.note && <p className="text-ink-500">{h.note}</p>}
                  <p className="text-2xs text-ink-400">
                    {new Date(h.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <OrderActionsPanel
            orderId={order.id}
            status={order.status as OrderStatus}
            fulfillmentStatus={order.fulfillment_status as FulfillmentStatus}
            fulfillmentEnabled={!!order.supplier_id}
            payment={
              payment
                ? {
                    id: payment.id,
                    method: payment.method,
                    amount: payment.amount,
                    status: payment.status as PaymentStatus,
                    reference: payment.reference,
                    receipt_url: receiptUrl,
                    admin_note: payment.admin_note,
                  }
                : null
            }
            ret={
              ret
                ? { id: (ret as ReturnRow).id, status: (ret as ReturnRow).status, reason: (ret as ReturnRow).reason, admin_note: (ret as ReturnRow).admin_note }
                : null
            }
            canWriteOrders={canWriteOrders}
            canVerifyPayments={canVerifyPayments}
            canWriteReturns={canWriteReturns}
          />

          {/* Customer & address */}
          <div className="card-pad space-y-2 text-xs">
            <h3 className="text-sm font-extrabold">العميل والعنوان</h3>
            <p className="font-bold">{addr.fullName ?? order.customer_name}</p>
            <p className="flex items-center gap-1.5" dir="ltr">
              <Phone className="h-3.5 w-3.5" /> {addr.phone ?? order.customer_phone}
            </p>
            {order.customer_email && <p dir="ltr" className="text-2xs text-ink-500">{order.customer_email}</p>}
            <p className="flex items-start gap-1.5 text-ink-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{[addr.governorate, addr.city, addr.address].filter(Boolean).join("، ")}</span>
            </p>
            {addr.notes && <p className="rounded-lg bg-ink-50 p-2 text-ink-600">ملاحظات: {addr.notes}</p>}
            {order.notes && <p className="rounded-lg bg-brand-50 p-2 text-brand-900">ملاحظات العميل: {order.notes}</p>}
            {order.internal_notes && <p className="rounded-lg bg-amber-50 p-2 text-amber-900">ملاحظات داخلية: {order.internal_notes}</p>}
          </div>

          {/* Supplier fulfillment (private) */}
          {canSeeSuppliers && order.supplier_id && (
            <div className="card-pad space-y-2 text-xs">
              <h3 className="text-sm font-extrabold">التدبير لدى المورّد</h3>
              <p className="font-bold">{supplier ? (supplier as SupplierRow).name : "—"}</p>
              <p>الحالة: <span className="font-semibold">{FULFILLMENT_AR[order.fulfillment_status as FulfillmentStatus]}</span></p>
              {supplier && (
                <div className="space-y-1">
                  {(supplier as SupplierRow).phone && (
                    <a href={`tel:${(supplier as SupplierRow).phone}`} className="flex items-center gap-1.5 text-brand-700" dir="ltr">
                      <Phone className="h-3.5 w-3.5" /> {(supplier as SupplierRow).phone}
                    </a>
                  )}
                  {(supplier as SupplierRow).alt_phone && (
                    <p className="flex items-center gap-1.5 text-brand-700" dir="ltr">
                      هاتف بديل: {(supplier as SupplierRow).alt_phone}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card-pad space-y-1 text-2xs text-ink-400">
            <p>طريقة الدفع: {PAYMENT_METHODS[order.payment_method as keyof typeof PAYMENT_METHODS]?.labelAr}</p>
            {order.idempotency_key && <p dir="ltr">Idempotency: {order.idempotency_key.slice(0, 8)}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
