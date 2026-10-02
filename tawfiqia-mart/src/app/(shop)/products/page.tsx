import type { Metadata } from "next";
import { CatalogResults, type CatalogParams } from "@/components/catalog/CatalogResults";

export const metadata: Metadata = {
  title: "كل المنتجات",
  description: "تصفح كل قطع غيار السيارات: زيوت، فلاتر، فرامل، كهرباء وقطع محرك لكل الماركات.",
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<CatalogParams> }) {
  const resolvedSearch = await searchParams;
  return (
    <div>
      <div className="border-b border-ink-100 bg-white">
        <div className="shell py-5">
          <h1 className="text-xl font-extrabold text-ink-950 md:text-2xl">كل المنتجات</h1>
        </div>
      </div>
      <CatalogResults searchParams={resolvedSearch} basePath="/products" />
    </div>
  );
}
