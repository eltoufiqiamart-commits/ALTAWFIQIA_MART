import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MapPin, CreditCard, History, Package as PackageIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/money";
import { imageUrl } from "@/lib/images";
import {
  ORDER_STATUS_AR,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_AR,
  PAYMENT_TONE,
} from "@/lib/orderStatus";
import { PAYMENT_METHODS, BUSINESS } from "@/lib/constants";
import { OrderActions } from "@/components/orders/OrderActions";
import { PaymentReferenceForm } from "@/components/checkout/PaymentInstructions";
import type {
  AddressRow,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types/database";

export const metadata: Metadata = { title: "تفاصيل الطلب", robots: { index: false } };
export const dynamic = "force-dynamic";

const TIMELINE: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "ready_for_shipment",
  "shipped",
  "out_for_delivery",
  "delivered",
];

export default async function OrderDetailPage({ params: _params }: { params: Promise<{ id: string }> }) {
  const params = await _params;
  const user = (await getCurrentUser())!;
  const sb = await createClient();

  const { data: order } = await sb
    .from("orders")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: items }, { data: payment }, { data: history }, { data: ret }] =
    await Promise.all([
      // SECTION 12/30: explicit column list — never `select("*")` here.
      // order_items now carries ADMIN-ONLY historical snapshot columns
      // (cost_amount_at_order, supplier_*_at_order). RLS lets the owner read
      // their own order rows, so a wildcard select would have serialized
      // supplier cost, name, phone and address straight into the customer's
      // page props.
      sb
        .from("order_items")
        .select(
          "id, order_id, product_id, sku, name_ar, name_en, image_url, unit_price_amount, quantity, line_total_amount",
        )
        .eq("order_id", order.id)
        .order("id"),
      // SECTION 30: only the fields this page actually renders. The full row
      // also holds `receipt_path` (private storage key) and `admin_note`
      // (internal verification remarks) — neither belongs in customer props.
      sb
        .from("payments")
        .select("id, order_id, method, amount, status, reference, created_at")
        .eq("order_id", order.id)
        .maybeSingle(),
      sb
        .from("order_status_history")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at"),
      // SECTION 30: `admin_note` on a return is internal staff commentary and
      // is deliberately excluded from the customer payload.
      sb
        .from("returns")
        .select("id, order_id, status, reason, created_at")
        .eq("order_id", order.id)
        .maybeSingle(),
    ]);

  const productIds = [...new Set((items ?? []).map((i) => i.product_id).filter(Boolean) as string[])];
  const { data: productSlugs } = productIds.length
    ? await sb.from("products").select("id, slug").in("id", productIds)
    : { data: [] };
  const slugMap = new Map((productSlugs ?? []).map((p) => [p.id, p.slug]));

  const status = order.status as OrderStatus;
  const paymentStatus = order.payment_status as PaymentStatus;
  const method = order.payment_method as PaymentMethod;
  const address = order.address_snapshot as unknown as Partial<AddressRow>;
  const currentStep = TIMELINE.indexOf(status);
  const cancelled = status === "cancelled";

  const canCancel = ["pending", "confirmed"].includes(status) && paymentStatus !== "paid";
  const canReturn = status === "delivered" && !ret;
  const needsPayment = method !== "cod" && ["unpaid", "rejected"].includes(paymentStatus);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-ink-950" dir="ltr">طلب {order.order_number}</h2>
          <p className="text-2xs text-ink-400">
            {new Date(order.placed_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge-${ORDER_STATUS_TONE[status]}`}>{ORDER_STATUS_AR[status]}</span>
          <span className={`badge-${PAYMENT_TONE[paymentStatus]}`}>{PAYMENT_STATUS_AR[paymentStatus]}</span>
        </div>
      </div>

      <OrderActions orderId={order.id} canCancel={canCancel} canReturn={canReturn} />

      {ret && (
        <div className="card-pad text-sm">
          <p className="font-bold text-ink-900">
            حالة الإرجاع:{" "}
            {
              { requested: "قيد المراجعة", approved: "تمت الموافقة", rejected: "مرفوض", received: "تم استلام المنتج", refunded: "تم رد المبلغ", cancelled: "ملغي" }[
                (ret as { status: keyof Record<string, string> }).status as string
              ]
            }
          </p>
          <p className="mt-1 text-ink-600">السبب: {(ret as { reason: string }).reason}</p>
        </div>
      )}

      {needsPayment && payment && (
        <PaymentReferenceForm paymentId={payment.id} method={method} />
      )}
      {paymentStatus === "awaiting_verification" && (
        <div className="rounded-xl border border-warning/30 bg-warningBg p-3.5 text-sm font-semibold text-warning">
          دفعتك بانتظار التأكيد من الإدارة. ستصلك إشعارًا فور المراجعة.
        </div>
      )}

      {/* Progress (hidden for cancelled/returns) */}
      {!cancelled && currentStep >= 0 && (
        <div className="card-pad">
          <ol className="hidden justify-between md:flex">
            {TIMELINE.map((s, i) => (
              <li key={s} className="flex flex-1 flex-col items-center gap-1.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-2xs font-bold ${
                    i <= currentStep ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-400"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`text-center text-2xs font-semibold ${i <= currentStep ? "text-ink-900" : "text-ink-400"}`}>
                  {ORDER_STATUS_AR[s]}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-sm font-semibold text-ink-800 md:hidden">
            الحالة الحالية: {ORDER_STATUS_AR[status]}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="card">
            <h3 className="flex items-center gap-2 border-b border-ink-100 p-4 font-extrabold text-ink-950">
              <PackageIcon className="h-5 w-5 text-brand-600" /> المنتجات
            </h3>
            <ul className="divide-y divide-ink-100">
              {(items ?? []).map((i) => (
                <li key={i.id} className="flex items-center gap-3 p-3.5">
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink-50">
                    {i.product_id && slugMap.get(i.product_id) ? (
                      <Link href={`/products/${slugMap.get(i.product_id)}`} className="absolute inset-0">
                        <Image src={imageUrl(i.image_url)} alt="" fill sizes="64px" className="object-cover" />
                      </Link>
                    ) : (
                      <Image src={imageUrl(i.image_url)} alt="" fill sizes="64px" className="object-cover" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    {i.product_id && slugMap.get(i.product_id) ? (
                      <Link
                        href={`/products/${slugMap.get(i.product_id)}`}
                        className="line-clamp-2 text-sm font-bold text-ink-900"
                      >
                        {i.name_ar}
                      </Link>
                    ) : (
                      <p className="line-clamp-2 text-sm font-bold text-ink-900">{i.name_ar}</p>
                    )}
                    <p className="text-2xs text-ink-400" dir="ltr">SKU: {i.sku}</p>
                    <p className="text-2xs text-ink-500">الكمية: {i.quantity}</p>
                  </div>
                  <span className="text-sm font-extrabold text-ink-900">{formatPrice(i.line_total_amount)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-pad">
            <h3 className="mb-2 flex items-center gap-2 font-extrabold text-ink-950">
              <History className="h-5 w-5 text-brand-600" /> سجل الحالة
            </h3>
            <ul className="space-y-2 text-sm">
              {(history ?? []).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink-800">
                    {ORDER_STATUS_AR[h.to_status as OrderStatus] ?? h.to_status}
                  </span>
                  <span className="text-2xs text-ink-400">
                    {new Date(h.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-pad">
            <h3 className="mb-2 flex items-center gap-2 font-extrabold text-ink-950">
              <MapPin className="h-5 w-5 text-brand-600" /> عنوان التوصيل
            </h3>
            <div className="space-y-1 text-sm text-ink-700">
              <p className="font-bold text-ink-900">{address.full_name} — <span dir="ltr">{address.phone}</span></p>
              <p>
                {address.governorate}، {address.city}
                {address.area ? `، ${address.area}` : ""}
              </p>
              <p>{address.street}{address.building ? `، عقارة ${address.building}` : ""}{address.apartment ? `، شقة ${address.apartment}` : ""}</p>
              {address.landmark && <p className="text-ink-500">علامة: {address.landmark}</p>}
            </div>
          </div>

          <div className="card-pad">
            <h3 className="mb-2 flex items-center gap-2 font-extrabold text-ink-950">
              <CreditCard className="h-5 w-5 text-brand-600" /> الدفع
            </h3>
            <p className="text-sm text-ink-700">{PAYMENT_METHODS[method].labelAr}</p>
            {payment?.reference && <p className="mt-1 text-2xs text-ink-500" dir="ltr">مرجع: {payment.reference}</p>}
            <div className="mt-3 space-y-1.5 text-sm">
              <Line label="إجمالي المنتجات" value={order.subtotal_amount} />
              {order.coupon_discount_amount > 0 && (
                <Line label={`كوبون${order.coupon_code ? ` (${order.coupon_code})` : ""}`} value={-order.coupon_discount_amount} />
              )}
              {order.prepaid_discount_amount > 0 && (
                <Line label="خصم الدفع المسبق" value={-order.prepaid_discount_amount} success />
              )}
              <Line label="الشحن" value={order.shipping_amount} />
              {order.cod_fee_amount > 0 && <Line label="رسوم الدفع عند الاستلام" value={order.cod_fee_amount} />}
              <div className="my-1 border-t border-dashed border-ink-200" />
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-ink-950">الإجمالي</span>
                <span className="text-lg font-extrabold text-brand-700">{formatPrice(order.grand_total_amount)}</span>
              </div>
            </div>
          </div>

          <Link
            href={`https://wa.me/${BUSINESS.whatsappInternational}?text=${encodeURIComponent(`استفسار عن الطلب ${order.order_number}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline btn-block"
          >
            استفسار عبر واتساب
          </Link>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, success }: { label: string; value: number; success?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-600">{label}</span>
      <span className={success ? "font-bold text-success" : "font-semibold text-ink-900"}>
        {value < 0 ? "−" : ""}
        {formatPrice(Math.abs(value))}
      </span>
    </div>
  );
}
