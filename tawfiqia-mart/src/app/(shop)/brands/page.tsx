import type { Metadata } from "next";
import Link from "next/link";
import { getActiveBrands } from "@/lib/server/catalog";

export const metadata: Metadata = {
  title: "ماركات السيارات",
  description: "قطع غيار لكل ماركات السيارات: تويوتا، هيونداي، كيا، بي إم دبليو، مرسيدس والمزيد.",
};
export const revalidate = 300;

export default async function BrandsPage() {
  const brands = await getActiveBrands();
  return (
    <div className="shell section">
      <h1 className="mb-5 text-xl font-extrabold text-ink-950 md:text-2xl">ماركات السيارات</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {brands.map((b) => (
          <Link
            key={b.id}
            href={`/brands/${b.slug}`}
            className="card group flex flex-col items-center gap-2 p-6 text-center transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-lg font-extrabold text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
              {(b.name_en || b.name_ar).charAt(0)}
            </span>
            <span className="text-sm font-bold text-ink-800">{b.name_ar}</span>
            {b.name_en && <span className="text-2xs text-ink-400">{b.name_en}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
