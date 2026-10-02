import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Package, ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_AR, ORDER_STATUS_TONE, PAYMENT_STATUS_AR } from "@/lib/orderStatus";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { imageUrl } from "@/lib/images";
import type { OrderStatus, PaymentStatus } from "@/types/database";

export const metadata: Metadata = { title: "طلباتي", robots: { index: false } };
export const dynamic = "force-dynamic";
const PER_PAGE = 10;

export default async function OrdersPage({ searchParams: _searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await _searchParams;
  const user = (await getCurrentUser())!;
  const sb = await createClient();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;

  const { data: orders, count } = await sb
    .from("orders")
    .select("id, order_number, placed_at, grand_total_amount, status, payment_status, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("placed_at", { ascending: false })
    .range(from, to);

  if (!orders || orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="لا توجد طلبات بعد"
        description="ابدأ التسوق وستظهر طلباتك وحالتها هنا."
        action={<Link href="/products" className="btn-primary">تسوق الآن</Link>}
      />
    );
  }

  const ids = orders.map((o) => o.id);
  const { data: items } = await sb
    .from("order_items")
    .select("id, order_id, name_ar, image_url, quantity")
    .in("order_id", ids);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold text-ink-950">طلباتي ({count})</h2>
      <ul className="space-y-3">
        {orders.map((o) => {
          const orderItems = (items ?? []).filter((i) => i.order_id === o.id);
          const tone = ORDER_STATUS_TONE[o.status as OrderStatus];
          return (
            <li key={o.id}>
              <Link
                href={`/account/orders/${o.id}`}
                className="card flex flex-col gap-3 p-4 transition hover:border-brand-300 sm:flex-row sm:items-center"
              >
                <div className="flex -space-x-3 space-x-reverse">
                  {orderItems.slice(0, 4).map((i) => (
                    <span key={i.id} className="relative h-12 w-12 overflow-hidden rounded-lg border-2 border-white bg-ink-50">
                      <Image src={imageUrl(i.image_url)} alt="" fill sizes="48px" className="object-cover" />
                    </span>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-ink-900" dir="ltr">{o.order_number}</p>
                  <p className="text-2xs text-ink-400">
                    {new Date(o.placed_at).toLocaleDateString("ar-EG", { dateStyle: "medium" })}
                    {" • "}
                    {orderItems.reduce((s, i) => s + i.quantity, 0)} منتج
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <span className={`badge-${tone}`}>{ORDER_STATUS_AR[o.status as OrderStatus]}</span>
                  <span className="text-2xs text-ink-400">{PAYMENT_STATUS_AR[o.payment_status as PaymentStatus]}</span>
                </div>
                <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                  <span className="text-sm font-extrabold text-brand-700">{formatPrice(o.grand_total_amount)}</span>
                  <ChevronLeft className="h-4 w-4 text-ink-300" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <Pagination page={page} totalPages={Math.ceil((count ?? 0) / PER_PAGE)} basePath="/account/orders" />
    </div>
  );
}
