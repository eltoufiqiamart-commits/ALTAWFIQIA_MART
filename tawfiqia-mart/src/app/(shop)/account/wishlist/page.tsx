import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductGrid } from "@/components/product/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PublicProductCard } from "@/types/database";

export const metadata: Metadata = { title: "المفضلة", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const user = (await getCurrentUser())!;
  const sb = await createClient();
  const { data } = await sb
    .from("wishlist_items")
    .select(
      `products(id, slug, sku, name_ar, name_en, short_description, price_amount, discount_percent,
        effective_price_amount, stock_quantity, condition, is_featured,
        rating_avg, review_count,
        brands!products_brand_id_fkey(id, slug, name_ar),
        categories!products_category_id_fkey(id, slug, name_ar),
        product_images(url, alt_text, is_primary, sort_order))`,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const cards: PublicProductCard[] = (data ?? [])
    .map((row) => row.products as unknown as Record<string, unknown> | null)
    .filter((p): p is Record<string, unknown> => !!p)
    .map((p) => {
      const images = (p.product_images as Array<{ url: string; alt_text: string; is_primary: boolean; sort_order: number }>) ?? [];
      const primary = images.find((i) => i.is_primary) ?? images.sort((a, b) => a.sort_order - b.sort_order)[0];
      const stock = Number(p.stock_quantity);
      return {
        id: p.id as string,
        slug: p.slug as string,
        sku: p.sku as string,
        nameAr: p.name_ar as string,
        nameEn: (p.name_en as string) ?? "",
        shortDescription: (p.short_description as string) ?? "",
        priceAmount: Number(p.price_amount),
        discountPercent: Number(p.discount_percent),
        effectivePriceAmount: Number(p.effective_price_amount),
        inStock: stock > 0,
        condition: p.condition as string,
        isFeatured: Boolean(p.is_featured),
        ratingAvg: Number(p.rating_avg),
        reviewCount: Number(p.review_count),
        brand: p.brands as PublicProductCard["brand"],
        category: p.categories as PublicProductCard["category"],
        image: primary ? { url: primary.url, alt: primary.alt_text } : null,
      };
    });

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="قائمة المفضلة فارغة"
        description="اضغط على رمز القلب بجانب أي منتج لحفظه هنا والعودة إليه لاحقًا."
        action={<Link href="/products" className="btn-primary">تصفح المنتجات</Link>}
      />
    );
  }
  return <ProductGrid products={cards} />;
}
