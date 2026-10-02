import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader, TableWrap, Th, Td } from "@/components/admin/ui";
import { formatPrice } from "@/lib/money";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { CsvTools } from "@/components/admin/CsvTools";
import type { ProductStatus } from "@/types/database";
import { can } from "@/lib/server/permissions-client";
import { pagedHref } from "@/lib/admin-query";

export const dynamic = "force-dynamic";
const PER = 25;

const STATUS_AR: Record<string, string> = {
  published: "منشور",
  draft: "مسودة",
  archived: "مؤرشف",
};
const STATUS_TONE: Record<string, string> = {
  published: "badge-success",
  draft: "badge-neutral",
  archived: "badge-danger",
};

export default async function AdminProductsPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const searchParams = await _searchParams;
  const { user, admin } = await adminPageContext("products.read");
  const canSeeCost = can(user.profile.role, "products.cost.view");
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = (searchParams.q ?? "").trim();
  const status = searchParams.status ?? "";

  // Private cost columns are selected only for roles permitted to see them.
  const columns = [
    "id, name_ar, sku, price_amount, effective_price_amount, status, stock_quantity, reserved_quantity, is_featured, deleted_at, categories(name_ar), brands(name_ar)",
    canSeeCost ? "cost_amount" : null,
  ]
    .filter(Boolean)
    .join(", ");

  let query = admin
    .from("products")
    .select(columns, { count: "exact" })
    .order("created_at", { ascending: false });

  const VALID_STATUSES: ProductStatus[] = ["published", "draft", "archived"];
  if (status && (VALID_STATUSES as string[]).includes(status)) {
    const st = status as ProductStatus;
    if (st === "archived") query = query.not("deleted_at", "is", null);
    else query = query.eq("status", st).is("deleted_at", null);
  } else {
    query = query.is("deleted_at", null);
  }
  if (q) {
    query = query.or(`name_ar.ilike.%${q.replace(/[%,]/g, "")}%,sku.ilike.%${q.replace(/[%,]/g, "")}%`);
  }
  const from = (page - 1) * PER;
  const { data: rawProducts, count } = await query.range(from, from + PER - 1);

  interface AdminProductRow {
    id: string;
    name_ar: string;
    sku: string;
    price_amount: number;
    effective_price_amount: number;
    cost_amount?: number;
    status: ProductStatus;
    stock_quantity: number;
    reserved_quantity: number;
    is_featured: boolean;
    deleted_at: string | null;
    categories: { name_ar: string } | null;
    brands: { name_ar: string } | null;
  }
  const products = (rawProducts ?? []) as unknown as AdminProductRow[];

  return (
    <div>
      <AdminHeader
        title="المنتجات"
        subtitle={`${count ?? 0} منتج`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CsvTools canWrite={can(user.profile.role, "products.write")} />
            {can(user.profile.role, "products.write") && (
              <Link href="/admin/products/new" className="btn-primary btn-sm">
                <Plus className="h-4 w-4" /> منتج جديد
              </Link>
            )}
          </div>
        }
      />

      <form className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث بالاسم أو SKU…"
            className="input input-sm pe-9"
          />
        </div>
        <select name="status" defaultValue={status} className="input input-sm w-36">
          <option value="">كل الحالات</option>
          <option value="published">منشور</option>
          <option value="draft">مسودة</option>
          <option value="archived">مؤرشف</option>
        </select>
        <button className="btn-outline btn-sm">بحث</button>
      </form>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {products.map((p) => {
          const cat = p.categories as unknown as { name_ar: string } | null;
          const brand = p.brands as unknown as { name_ar: string } | null;
          return (
            <div key={p.id} className="card-pad">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink-900">{p.name_ar}</p>
                  <p className="text-2xs text-ink-400" dir="ltr">{p.sku}</p>
                </div>
                <span className={`badge ${STATUS_TONE[p.status]}`}>{STATUS_AR[p.status as ProductStatus]}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-extrabold text-ink-900">{formatPrice(Number(p.effective_price_amount))}</span>
                <span className={Number(p.stock_quantity) - Number(p.reserved_quantity) <= 0 ? "text-danger" : "text-ink-500"}>
                  متاح: {Math.max(0, Number(p.stock_quantity) - Number(p.reserved_quantity))}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-2xs text-ink-400">{brand?.name_ar ?? "—"} • {cat?.name_ar ?? "—"}</span>
                <ProductRowActions product={p} canWrite={can(user.profile.role, "products.write")} canDelete={can(user.profile.role, "products.delete")} compact />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <TableWrap>
          <thead>
            <tr>
              <Th>المنتج</Th>
              <Th>الماركة / القسم</Th>
              <Th>سعر البيع</Th>
              {canSeeCost && <Th>التكلفة</Th>}
              <Th>المخزون</Th>
              <Th>الحالة</Th>
              <Th>إجراءات</Th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const cat = p.categories as unknown as { name_ar: string } | null;
              const brand = p.brands as unknown as { name_ar: string } | null;
              const available = Number(p.stock_quantity) - Number(p.reserved_quantity);
              return (
                <tr key={p.id}>
                  <Td>
                    <p className="max-w-64 truncate font-bold text-ink-900">{p.name_ar}</p>
                    <p className="text-2xs text-ink-400" dir="ltr">{p.sku}</p>
                  </Td>
                  <Td className="text-2xs">{brand?.name_ar ?? "—"}<br />{cat?.name_ar ?? "—"}</Td>
                  <Td className="font-bold">{formatPrice(Number(p.effective_price_amount))}</Td>
                  {canSeeCost && (
                    <Td className="text-ink-500">{formatPrice(Number(p.cost_amount ?? 0))}</Td>
                  )}
                  <Td>
                    <span className={available <= 0 ? "font-bold text-danger" : ""}>{available}</span>
                  </Td>
                  <Td><span className={`badge ${STATUS_TONE[p.status]}`}>{STATUS_AR[p.status as ProductStatus]}</span></Td>
                  <Td>
                    <ProductRowActions
                      product={p}
                      canWrite={can(user.profile.role, "products.write")}
                      canDelete={can(user.profile.role, "products.delete")}
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </div>

      <PaginationAdmin page={page} total={count ?? 0} per={PER} params={searchParams} />
    </div>
  );
}

function PaginationAdmin({
  page,
  total,
  per,
  params,
}: {
  page: number;
  total: number;
  per: number;
  params: Record<string, string | undefined>;
}) {
  const totalPages = Math.ceil(total / per);
  if (totalPages <= 1) return null;
  const make = (p: number) => pagedHref("/admin/products", p, params);
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      {page > 1 && <Link href={make(page - 1)} className="btn-outline btn-sm">السابق</Link>}
      <span className="text-xs text-ink-500">صفحة {page} من {totalPages}</span>
      {page < totalPages && <Link href={make(page + 1)} className="btn-outline btn-sm">التالي</Link>}
    </div>
  );
}
