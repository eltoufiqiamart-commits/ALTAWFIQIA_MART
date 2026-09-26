import { Hero } from "@/components/home/Hero";
import { BrandsBar } from "@/components/home/BrandsBar";
import { CategoriesGrid } from "@/components/home/CategoriesGrid";
import { ProductRail } from "@/components/product/ProductRail";
import { PromoSection } from "@/components/home/PromoSection";
import { TrustStrip } from "@/components/home/TrustStrip";
import { SectionHeading } from "@/components/home/SectionHeading";
import { ProductGrid } from "@/components/product/ProductCard";
import { BannerSlider, BannerBand } from "@/components/home/BannerSlider";
import {
  getActiveBrands,
  getFeatured,
  getNewest,
  getOffers,
  getPublishedCategories,
  getActiveBanners,
  getCuratedSections,
} from "@/lib/server/catalog";

export const revalidate = 120;

export default async function HomePage() {
  // Section 6: the three automatic product rails used to be fetched
  // unconditionally and then thrown away whenever an admin-curated section
  // replaced them — up to three wasted catalog queries on every homepage
  // render. Curated sections are resolved FIRST, then only the rails that are
  // actually still needed are fetched (still in parallel, so latency is
  // unchanged when nothing is curated).
  const [categories, brands, heroBanners, bandBanners, sideBanners, curatedSections] =
    await Promise.all([
      getPublishedCategories(),
      getActiveBrands(),
      getActiveBanners("home_hero"),
      getActiveBanners("home_band"),
      getActiveBanners("sidebar"),
      getCuratedSections(),
    ]);

  // Admin-curated sections override the automatic rails when populated.
  const byKey = new Map(curatedSections.map((s) => [s.key, s.products]));
  const [featured, offers, newest] = await Promise.all([
    byKey.has("featured") ? Promise.resolve([]) : getFeatured(8),
    byKey.has("latest-offers") ? Promise.resolve([]) : getOffers(10),
    byKey.has("newest") ? Promise.resolve([]) : getNewest(10),
  ]);
  const featuredProducts = byKey.get("featured") ?? featured;
  const offerProducts = byKey.get("latest-offers") ?? offers;
  const newestProducts = byKey.get("newest") ?? newest;
  const extraSections = curatedSections.filter(
    (s) => !["featured", "latest-offers", "newest"].includes(s.key),
  );
  const stripBanners = [...bandBanners, ...sideBanners].slice(0, 2);

  return (
    <>
      <Hero />

      {heroBanners.length > 0 && <BannerSlider banners={heroBanners} className="mt-4 md:mt-6" />}

      <BrandsBar brands={brands} />
      <div className="bg-white">
        <CategoriesGrid categories={categories} />
      </div>

      {featuredProducts.length > 0 && (
        <section className="section pt-0 md:pt-0">
          <div className="shell">
            <SectionHeading title="منتجات مميزة" href="/products" />
            <ProductGrid products={featuredProducts} />
          </div>
        </section>
      )}

      <PromoSection />
      <TrustStrip />

      {offerProducts.length > 0 && (
        <ProductRail title="أحدث العروض والخصومات" products={offerProducts} href="/products?offers=1" />
      )}

      {stripBanners.length > 0 && <BannerBand banners={stripBanners} className="mb-6 md:mb-8" />}

      {extraSections.map((s) => (
        <div key={s.id} className="bg-white">
          <ProductRail title={s.title} products={s.products} href="/products" />
        </div>
      ))}

      <div className="bg-white">
        {newestProducts.length > 0 && (
          <ProductRail title="وصل حديثًا" products={newestProducts} href="/products?sort=newest" />
        )}
      </div>
    </>
  );
}
