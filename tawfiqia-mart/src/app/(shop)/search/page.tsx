import type { Metadata } from "next";
import { CatalogResults, type CatalogParams } from "@/components/catalog/CatalogResults";
import { createClient } from "@/lib/supabase/server";
import { queryProducts } from "@/lib/server/catalog";

export const metadata: Metadata = { title: "نتائج البحث", robots: { index: false } };

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams: _searchParams }: { searchParams: Promise<CatalogParams> }) {
  const searchParams = await _searchParams;
  const q = (searchParams.q ?? "").trim();

  // Anonymous, aggregated search analytics (no personal data) — best effort.
  //
  // This used to run a SECOND full product search purely to obtain a total for
  // the analytics row, doubling the cost of every search request. It now calls
  // queryProducts with exactly the same arguments CatalogResults will use, and
  // request-level memoization (React cache in lib/server/catalog) makes the two
  // calls share a single database execution.
  if (q.length >= 2) {
    try {
      const sb = await createClient();
      const result = await queryProducts({
        query: q,
        page: Math.max(1, Number(searchParams.page) || 1),
        sort:
          (searchParams.sort as "newest" | "price_asc" | "price_desc" | "popular" | "rating") ??
          "newest",
        brandId: searchParams.brandId,
        categoryId: searchParams.categoryId,
        minPrice: searchParams.minPrice,
        maxPrice: searchParams.maxPrice,
        inStock: searchParams.inStock === "true",
        condition: searchParams.condition,
        engineId: searchParams.engineId,
        featured: searchParams.featured === "true" || undefined,
      });
      await sb.rpc("log_search", { p_term: q, p_results: result.total });
    } catch {
      /* analytics must never block the UI */
    }
  }

  return (
    <div>
      <div className="border-b border-ink-100 bg-white">
        <div className="shell py-5">
          <h1 className="text-xl font-extrabold text-ink-950 md:text-2xl">
            {q ? <>نتائج البحث عن: <span className="text-brand-700">«{q}»</span></> : "البحث في المنتجات"}
          </h1>
        </div>
      </div>
      <CatalogResults searchParams={searchParams} basePath="/search" />
    </div>
  );
}
