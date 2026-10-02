import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { RatingStars } from "@/components/ui/Rating";

export const metadata: Metadata = { title: "تقييماتي", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_AR: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "منشور",
  hidden: "مخفي",
};

export default async function MyReviewsPage() {
  const user = (await getCurrentUser())!;
  const sb = await createClient();
  const { data } = await sb
    .from("reviews")
    .select(
      "id, rating, comment, status, created_at, products!reviews_product_id_fkey(id, slug, name_ar)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="لا توجد تقييمات بعد"
        description="بعد استلام طلبك يمكنك تقييم المنتجات التي اشتريتها من صفحة المنتج."
        action={<Link href="/account/orders" className="btn-primary">طلباتي</Link>}
      />
    );
  }

  return (
    <ul className="space-y-3">
      {data.map((r) => {
        const p = r.products as unknown as { id: string; slug: string; name_ar: string } | null;
        return (
          <li key={r.id} className="card-pad">
            <div className="flex items-center justify-between gap-2">
              {p ? (
                <Link href={`/products/${p.slug}`} className="text-sm font-bold text-brand-700">
                  {p.name_ar}
                </Link>
              ) : (
                <span className="text-sm font-bold text-ink-700">منتج</span>
              )}
              <span className="badge-neutral">{STATUS_AR[r.status] ?? r.status}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <RatingStars value={r.rating} size={15} />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{r.comment}</p>
          </li>
        );
      })}
    </ul>
  );
}
