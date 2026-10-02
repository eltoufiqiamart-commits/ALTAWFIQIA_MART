import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, RotateCcw, Truck, BadgeCheck, Package } from "lucide-react";
import {
  getProductBySlug,
  getRelatedProducts,
  getProductReviews,
} from "@/lib/server/catalog";
import { createClient } from "@/lib/supabase/server";
import { safeJsonLd } from "@/lib/json-ld";
import { getCurrentUser } from "@/lib/server/auth";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { ProductTabs } from "@/components/product/ProductTabs";
import { ReviewForm } from "@/components/product/ReviewForm";
import { ProductGrid } from "@/components/product/ProductCard";
import { Price, DiscountBadge } from "@/components/ui/Price";
import { RatingStars } from "@/components/ui/Rating";
import { BUSINESS } from "@/lib/constants";

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface CompatRow {
  id: string;
  notes: string;
  engine: {
    id: string;
    year: number;
    name: string;
    displacement_l: string | null;
    fuel_type: string;
    transmission: string;
    model: {
      id: string;
      slug: string;
      name_ar: string;
      make: { id: string; slug: string; name_ar: string };
    };
  };
}
interface Detail {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  shortDescription: string;
  description: string;
  categoryId: string | null;
  price: number;
  discountPercent: number;
  effectivePrice: number;
  condition: "new" | "genuine" | "aftermarket";
  oemNumber: string;
  partNumber: string;
  altPartNumbers: string[];
  specs: Record<string, string>;
  warranty: string;
  isReturnable: boolean;
  reviewCount: number;
  ratingAvg: number;
  metaTitle: string | null;
  metaDescription: string | null;
  images: { id: string; url: string; alt: string }[];
  brand: { id: string; slug: string; nameAr: string; nameEn: string } | null;
  category: { id: string; slug: string; nameAr: string } | null;
  compat: CompatRow[];
}

function normalize(raw: Record<string, unknown>): Detail {
  const images = ((raw.product_images as Array<Record<string, unknown>>) ?? []).map((i) => ({
    id: i.id as string,
    url: i.url as string,
    alt: (i.alt_text as string) ?? "",
  }));
  const brand = (raw.brand as Detail["brand"]) ?? null;
  const category = (raw.category as Detail["category"]) ?? null;
  const compat = ((raw.product_compatibilities as CompatRow[]) ?? []);
  return {
    id: raw.id as string,
    sku: raw.sku as string,
    nameAr: raw.name_ar as string,
    nameEn: (raw.name_en as string) ?? "",
    shortDescription: (raw.short_description as string) ?? "",
    description: (raw.description as string) ?? "",
    categoryId: (raw.category_id as string) ?? null,
    price: Number(raw.price_amount),
    discountPercent: Number(raw.discount_percent),
    effectivePrice: Number(raw.effective_price_amount),
    condition: raw.condition as Detail["condition"],
    oemNumber: (raw.oem_number as string) ?? "",
    partNumber: (raw.part_number as string) ?? "",
    altPartNumbers: Array.isArray(raw.alt_part_numbers) ? (raw.alt_part_numbers as string[]) : [],
    specs: ((raw.specs as Record<string, string>) ?? {}),
    warranty: (raw.warranty as string) ?? "",
    isReturnable: Boolean(raw.is_returnable),
    reviewCount: Number(raw.review_count ?? 0),
    ratingAvg: Number(raw.rating_avg ?? 0),
    metaTitle: (raw.meta_title as string) ?? null,
    metaDescription: (raw.meta_description as string) ?? null,
    images,
    brand,
    category,
    compat,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const raw = await getProductBySlug(slug);
  if (!raw) return { title: "المنتج غير موجود" };
  const p = normalize(raw);
  return {
    title: p.metaTitle || p.nameAr,
    description: p.metaDescription || p.shortDescription || p.nameAr,
    openGraph: p.images[0]
      ? { images: [{ url: p.images[0].url, alt: p.nameAr }] }
      : undefined,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const raw = await getProductBySlug(slug);
  if (!raw) notFound();
  const p = normalize(raw);

  const user = await getCurrentUser();
  const sb = await createClient();

  const related = await getRelatedProducts(p.categoryId, p.id, 8);
  const reviews = await getProductReviews(p.id);

  let canReview = false;
  let hasReviewed = false;
  let wished = false;
  let inStock = false;
  if (user) {
    const [{ data: product }, { data: delivered }, { data: myReview }, { data: wish }] =
      await Promise.all([
        sb.from("products").select("stock_quantity").eq("id", p.id).maybeSingle(),
        sb
          .from("order_items")
          .select("id, orders!inner(id, user_id, status)")
          .eq("product_id", p.id)
          .eq("orders.user_id", user.id)
          .eq("orders.status", "delivered")
          .limit(1),
        sb
          .from("reviews")
          .select("id, status")
          .eq("product_id", p.id)
          .eq("user_id", user.id)
          .maybeSingle(),
        sb
          .from("wishlist_items")
          .select("id")
          .eq("product_id", p.id)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
    // reserved_quantity is a private column; exact availability is enforced at
    // order placement. stock_quantity drives the customer-facing badge only.
    inStock = Number(product?.stock_quantity ?? 0) > 0;
    canReview = !!delivered && delivered.length > 0;
    hasReviewed = !!myReview;
    wished = !!wish;
  } else {
    const { data: product } = await sb
      .from("products")
      .select("stock_quantity")
      .eq("id", p.id)
      .maybeSingle();
    inStock = Number(product?.stock_quantity ?? 0) > 0;
  }

  const conditionLabel = { new: "جديد", genuine: "أصلي", aftermarket: "بديل" }[p.condition];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.nameAr,
    sku: p.sku,
    mpn: p.partNumber || p.oemNumber || undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand.nameAr } : undefined,
    description: p.shortDescription || p.description || p.nameAr,
    image: p.images.map((i) => i.url),
    offers: {
      "@type": "Offer",
      price: p.effectivePrice / 100,
      priceCurrency: "EGP",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    aggregateRating:
      p.reviewCount > 0
        ? { "@type": "AggregateRating", ratingValue: p.ratingAvg, reviewCount: p.reviewCount }
        : undefined,
  };

  return (
    <div className="shell section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-2xs text-ink-400" aria-label="مسار التنقل">
        <Link href="/" className="hover:text-brand-700">الرئيسية</Link>
        <span>/</span>
        {p.category && (
          <>
            <Link href={`/categories/${p.category.slug}`} className="hover:text-brand-700">{p.category.nameAr}</Link>
            <span>/</span>
          </>
        )}
        <span className="text-ink-700">{p.nameAr}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-2 lg:gap-10">
        <ProductGallery name={p.nameAr} images={p.images.map((i) => ({ url: i.url, alt: i.alt || p.nameAr }))} />

        <div>
          {p.brand && (
            <Link href={`/brands/${p.brand.slug}`} className="text-sm font-bold text-brand-700 hover:underline">
              {p.brand.nameAr}
            </Link>
          )}
          <h1 className="mt-1 text-xl font-extrabold leading-snug text-ink-950 md:text-2xl">{p.nameAr}</h1>
          {p.nameEn && <p className="mt-0.5 text-sm text-ink-400">{p.nameEn}</p>}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="badge-neutral">{conditionLabel}</span>
            {p.isReturnable ? (
              <span className="badge-success"><RotateCcw className="h-3 w-3" /> قابل للإرجاع</span>
            ) : (
              <span className="badge-neutral">غير قابل للإرجاع</span>
            )}
            {p.warranty && (
              <span className="badge-brand"><ShieldCheck className="h-3 w-3" /> {p.warranty}</span>
            )}
          </div>

          {p.reviewCount > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <RatingStars value={p.ratingAvg} />
              <span className="text-xs text-ink-500">{p.ratingAvg.toFixed(1)} ({p.reviewCount} تقييم)</span>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-ink-50 p-4">
            <Price effective={p.effectivePrice} original={p.discountPercent > 0 ? p.price : null} size="xl" />
            {p.discountPercent > 0 && <DiscountBadge percent={p.discountPercent} />}
          </div>

          {(p.oemNumber || p.partNumber || p.sku) && (
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {p.oemNumber && <CodeRow label="رقم OEM" value={p.oemNumber} />}
              {p.partNumber && <CodeRow label="رقم القطعة" value={p.partNumber} />}
              {p.altPartNumbers.length > 0 && <CodeRow label="أرقام بديلة" value={p.altPartNumbers.join("، ")} />}
              <CodeRow label="كود SKU" value={p.sku} />
            </dl>
          )}

          <div className="mt-5">
            <ProductPurchase productId={p.id} inStock={inStock} wished={wished} />
          </div>

          <ul className="mt-5 space-y-2 text-xs text-ink-600">
            <li className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-brand-600" /> {BUSINESS.shippingNoteAr}
            </li>
            <li className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-brand-600" /> إمكانية الإرجاع والاستبدال خلال {BUSINESS.returnWindowDays} يومًا
            </li>
            <li className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-brand-600" /> قطع أصلية وبديلة بجودة موثوقة
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-10">
        <ProductTabs
          tabs={[
            {
              key: "description",
              label: "الوصف",
              content: p.description ? (
                <div className="whitespace-pre-line leading-loose">{p.description}</div>
              ) : (
                <p className="text-ink-500">{p.shortDescription || "لا يوجد وصف إضافي."}</p>
              ),
            },
            {
              key: "specs",
              label: "المواصفات",
              content: Object.keys(p.specs).length > 0 ? (
                <dl className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-100">
                  {Object.entries(p.specs).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-3 gap-2 px-4 py-2.5 odd:bg-ink-50">
                      <dt className="font-bold text-ink-800">{k}</dt>
                      <dd className="col-span-2 text-ink-600">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-ink-500">لا توجد مواصفات تفصيلية.</p>
              ),
            },
            {
              key: "compatibility",
              label: `التوافق (${p.compat.length})`,
              content: p.compat.length > 0 ? (
                <ul className="space-y-2">
                  {p.compat.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-100 p-3">
                      <Package className="h-4 w-4 text-brand-600" />
                      <span className="font-bold text-ink-900">{c.engine.model.make.name_ar}</span>
                      <span className="text-ink-300">/</span>
                      <span>{c.engine.model.name_ar}</span>
                      <span className="text-ink-300">/</span>
                      <span>{c.engine.year}</span>
                      <span className="badge-neutral">
                        {c.engine.displacement_l ? `${c.engine.name} ${c.engine.displacement_l}` : c.engine.name}
                      </span>
                      <span className="badge-neutral">{c.engine.fuel_type}</span>
                      <span className="badge-neutral">{c.engine.transmission}</span>
                      {c.notes && <span className="w-full text-2xs text-ink-400">{c.notes}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-500">
                  لم يتم تسجيل توافق محدد. تواصل معنا برقم الشاسيه للتأكد من ملاءمة القطعة لسيارتك.
                </p>
              ),
            },
            {
              key: "reviews",
              label: `التقييمات (${reviews.length})`,
              content: (
                <div className="space-y-5">
                  {user ? (
                    <ReviewForm productId={p.id} canReview={canReview} hasReviewed={hasReviewed} />
                  ) : (
                    <p className="rounded-xl bg-ink-50 p-4 text-sm">
                      <Link href="/login" className="font-bold text-brand-700">سجل الدخول</Link> لتقييم المنتج بعد الشراء.
                    </p>
                  )}
                  {reviews.length > 0 ? (
                    <ul className="space-y-3">
                      {reviews.map((r) => {
                        const review = r as unknown as {
                          id: string;
                          rating: number;
                          comment: string;
                          created_at: string;
                          author_name: string;
                        };
                        return (
                          <li key={review.id} className="rounded-xl border border-ink-100 p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-ink-900">{review.author_name}</span>
                              <RatingStars value={Number(review.rating)} size={14} />
                            </div>
                            <p className="mt-1.5 leading-relaxed text-ink-700">{review.comment}</p>
                            <p className="mt-1 text-2xs text-ink-400">
                              {new Date(review.created_at).toLocaleDateString("ar-EG", { dateStyle: "medium" })}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-ink-500">لا توجد تقييمات بعد — كن أول من يقيّم المنتج.</p>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-extrabold text-ink-950">منتجات ذات صلة</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}

function CodeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-ink-50 px-3 py-2">
      <dt className="text-2xs text-ink-400">{label}</dt>
      <dd className="font-bold text-ink-800" dir="ltr">{value}</dd>
    </div>
  );
}
