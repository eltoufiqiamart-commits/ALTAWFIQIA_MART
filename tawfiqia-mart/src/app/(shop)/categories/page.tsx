import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { getPublishedCategories } from "@/lib/server/catalog";
import { CATEGORY_ICONS } from "@/components/home/CategoriesGrid";

export const metadata: Metadata = {
  title: "الأقسام",
  description: "تصفح كل أقسام قطع غيار السيارات في التوفيقية مارت.",
};
export const revalidate = 300;

export default async function CategoriesPage() {
  const categories = await getPublishedCategories();
  return (
    <div className="shell section">
      <h1 className="mb-5 text-xl font-extrabold text-ink-950 md:text-2xl">كل الأقسام</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {categories.map((c) => {
          const Icon = CATEGORY_ICONS[c.slug] ?? LayoutGrid;
          return (
            <Link
              key={c.id}
              href={`/categories/${c.slug}`}
              className="card group flex flex-col items-center gap-2.5 p-5 text-center transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                <Icon className="h-7 w-7" strokeWidth={1.7} />
              </span>
              <span className="text-sm font-bold text-ink-800">{c.name_ar}</span>
              {c.name_en && <span className="text-2xs text-ink-400">{c.name_en}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
