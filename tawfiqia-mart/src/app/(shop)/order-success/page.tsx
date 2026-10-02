import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Wallet, Truck } from "lucide-react";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/money";
import { BUSINESS, whatsappLink } from "@/lib/constants";
import { PAYMENT_METHODS } from "@/lib/constants";
import { PaymentReferenceForm } from "@/components/checkout/PaymentInstructions";
import type { PaymentMethod } from "@/types/database";

export const metadata: Metadata = { title: "تم استلام الطلب", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ number?: string }>;
}) {
  const searchParams = await _searchParams;
  const user = await getCurrentUser();
  const sb = await createClient();
  const number = searchParams.number;

  const { data: order } = number
    ? await sb
        .from("orders")
        .select("id, order_number, grand_total_amount, payment_method, payment_status, status")
        .eq("order_number", number)
        .maybeSingle()
    : { data: null };

  const payment = order
    ? (
        await sb
          .from("payments")
          .select("id, method, status, amount")
          .eq("order_id", order.id)
          .maybeSingle()
      ).data
    : null;

  const method = order?.payment_method as PaymentMethod | undefined;
  const prepaid = method && method !== "cod";

  return (
    <div className="shell section max-w-xl">
      <div className="card-pad text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-successBg text-success">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h1 className="text-xl font-extrabold text-ink-950">تم استلام طلبك بنجاح</h1>
        {order ? (
          <>
            <p className="mt-2 text-sm text-ink-600">
              رقم الطلب: <span className="font-extrabold text-ink-900" dir="ltr">{order.order_number}</span>
            </p>
            <p className="mt-1 text-sm text-ink-600">
              الإجمالي المطلوب: <span className="font-extrabold text-brand-700">{formatPrice(order.grand_total_amount)}</span>
            </p>
            <p className="mt-1 text-sm text-ink-600">
              طريقة الدفع: {method ? PAYMENT_METHODS[method].labelAr : ""}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-600">سنتواصل معك قريبًا لتأكيد الطلب.</p>
        )}

        <div className="mt-5 flex items-start gap-3 rounded-xl bg-brand-50 p-3.5 text-start text-sm leading-relaxed text-ink-700">
          <Truck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          {BUSINESS.shippingNoteAr}
        </div>

        {prepaid && payment && payment.status !== "paid" && order && (
          <div className="mt-5 text-start">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-accent-700">
              <Wallet className="h-4 w-4" />
              أكمل الدفع لإتمام الطلب
            </div>
            <PaymentReferenceForm paymentId={payment.id} method={method!} />
          </div>
        )}

        {prepaid && payment?.status === "awaiting_verification" && (
          <p className="mt-4 rounded-xl bg-warningBg p-3 text-sm font-semibold text-warning">
            استلمنا مرجع الدفع وسيتم تأكيده من الإدارة في أقرب وقت.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {order && (
            <Link href={`/account/orders/${order.id}`} className="btn-primary">متابعة حالة الطلب</Link>
          )}
          <Link href="/products" className="btn-outline">متابعة التسوق</Link>
        </div>
        <a
          href={whatsappLink(`استفسار بخصوص الطلب رقم ${number ?? ""}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs font-bold text-brand-700"
        >
          لديك استفسار؟ تواصل عبر واتساب
        </a>
        {!user && <Link href="/login" className="mt-2 block text-xs text-ink-400">تسجيل الدخول لمتابعة الطلب</Link>}
      </div>
    </div>
  );
}
