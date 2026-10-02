import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrandBySlug } from "@/lib/server/catalog";
import { CatalogResults, type CatalogParams } from "@/components/catalog/CatalogResults";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatalogParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) return { title: "الماركة غير موجودة" };
  return {
    title: brand.meta_title || `قطع غيار ${brand.name_ar}`,
    description: brand.meta_description || `قطع غيار سيارات ${brand.name_ar} في التوفيقية مارت`,
  };
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearch = await searchParams;
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();
  return (
    <div>
      <div className="border-b border-ink-100 bg-white">
        <div className="shell flex items-center gap-4 py-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-xl font-extrabold text-brand-700">
            {(brand.name_en || brand.name_ar).charAt(0)}
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-ink-950 md:text-2xl">
              قطع غيار {brand.name_ar}
            </h1>
            {brand.name_en && <p className="text-sm text-ink-400">{brand.name_en}</p>}
          </div>
        </div>
      </div>
      <CatalogResults searchParams={resolvedSearch} basePath={`/brands/${brand.slug}`} fixedBrand={brand.id} />
    </div>
  );
}
