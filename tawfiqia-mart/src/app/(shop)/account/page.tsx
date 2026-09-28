import Link from "next/link";
import { Package, MapPin, Heart, Wallet, ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_AR, ORDER_STATUS_TONE } from "@/lib/orderStatus";
import type { OrderStatus } from "@/types/database";

export const metadata = { title: "لوحة الحساب" };

export default async function AccountDashboard() {
  const user = (await getCurrentUser())!;
  const sb = await createClient();
  const [
    { data: orders },
    { count: orderCount },
    { count: wishlist },
    { count: addresses },
    { count: unread },
  ] = await Promise.all([
    sb
      .from("orders")
      .select("id, order_number, placed_at, grand_total_amount, status, payment_status")
      .eq("user_id", user.id)
      .order("placed_at", { ascending: false })
      .limit(5),
    sb.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    sb.from("wishlist_items").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    sb.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    sb
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
  ]);

  const stats = [
    { label: "الطلبات", value: orderCount ?? 0, href: "/account/orders", icon: Package },
    { label: "العناوين المحفوظة", value: addresses ?? 0, href: "/account/addresses", icon: MapPin },
    { label: "المفضلة", value: wishlist ?? 0, href: "/account/wishlist", icon: Heart },
    { label: "إشعارات غير مقروءة", value: unread ?? 0, href: "/account/notifications", icon: Wallet },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card flex flex-col gap-2 p-4 transition hover:border-brand-300">
            <s.icon className="h-6 w-6 text-brand-600" />
            <span className="text-2xl font-extrabold text-ink-950">{s.value}</span>
            <span className="text-2xs text-ink-500">{s.label}</span>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-ink-100 p-4">
          <h2 className="font-extrabold text-ink-950">أحدث الطلبات</h2>
          <Link href="/account/orders" className="flex items-center text-xs font-bold text-brand-700">
            عرض الكل <ChevronLeft className="h-4 w-4" />
          </Link>
        </div>
        {orders && orders.length > 0 ? (
          <ul className="divide-y divide-ink-100">
            {orders.map((o) => {
              const tone = ORDER_STATUS_TONE[o.status as OrderStatus];
              return (
                <li key={o.id}>
                  <Link href={`/account/orders/${o.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-ink-50">
                    <div>
                      <p className="text-sm font-bold text-ink-900" dir="ltr">{o.order_number}</p>
                      <p className="text-2xs text-ink-400">
                        {new Date(o.placed_at).toLocaleDateString("ar-EG", { dateStyle: "medium" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`badge-${tone === "brand" ? "brand" : tone}`}>
                        {ORDER_STATUS_AR[o.status as OrderStatus]}
                      </span>
                      <span className="text-sm font-extrabold text-ink-900">{formatPrice(o.grand_total_amount)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm text-ink-500">لا توجد طلبات بعد.</div>
        )}
      </div>
    </div>
  );
}
