import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/server/catalog";
import { CatalogResults, type CatalogParams } from "@/components/catalog/CatalogResults";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CatalogParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "القسم غير موجود" };
  return {
    title: category.meta_title || category.name_ar,
    description: category.meta_description || category.description || `قطع غيار قسم ${category.name_ar} في التوفيقية مارت`,
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearch = await searchParams;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();
  return (
    <div>
      <div className="border-b border-ink-100 bg-white">
        <div className="shell py-5">
          <nav className="text-2xs text-ink-400" aria-label="مسار التنقل">
            الرئيسية / الأقسام / <span className="text-ink-700">{category.name_ar}</span>
          </nav>
          <h1 className="mt-1 text-xl font-extrabold text-ink-950 md:text-2xl">{category.name_ar}</h1>
          {category.description && (
            <p className="mt-1 max-w-2xl text-sm text-ink-500">{category.description}</p>
          )}
        </div>
      </div>
      <CatalogResults searchParams={resolvedSearch} basePath={`/categories/${category.slug}`} fixedCategory={category.id} />
    </div>
  );
}
