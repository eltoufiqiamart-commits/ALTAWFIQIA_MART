import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { roleCan } from "@/lib/permissions";
import { AdminHeader } from "@/components/admin/ui";
import { ProductForm, type ProductInitial } from "@/components/admin/ProductForm";
import { ImageManager } from "@/components/admin/ImageManager";
import { CompatibilityManager, type CompatEntry } from "@/components/admin/CompatibilityManager";
import { toEgpInput } from "@/lib/money";
import type { ProductImageRow, VehicleMakeRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params: _params }: { params: Promise<{ id: string }> }) {
  const params = await _params;
  // The editor is a write surface; staff with products.read only use the list.
  const { user, admin } = await adminPageContext("products.write");
  const canSeeCost = roleCan(user.profile.role, "products.cost.view");

  const [{ data: p }, { data: images }, { data: compat }, { data: makes }, { data: categories }, { data: brands }, { data: suppliers }] =
    await Promise.all([
      admin.from("products").select("*").eq("id", params.id).maybeSingle(),
      admin.from("product_images").select("*").eq("product_id", params.id).order("sort_order"),
      admin
        .from("product_compatibilities")
        .select(
          "engine_id, engine:vehicle_engines(id, year, name, displacement_l, model:vehicle_models(id, name_ar, make:vehicle_makes(id, name_ar)))",
        )
        .eq("product_id", params.id),
      admin.from("vehicle_makes").select("*").eq("is_active", true).order("sort_order"),
      admin.from("categories").select("id, name_ar").is("deleted_at", null).order("sort_order"),
      admin.from("brands").select("id, name_ar").is("deleted_at", null).order("name_ar"),
      canSeeCost
        ? admin.from("suppliers").select("id, name").is("deleted_at", null).eq("is_active", true)
        : Promise.resolve({ data: [] }),
    ]);

  if (!p) notFound();

  const specsText = Object.entries((p.specs as Record<string, string>) ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const initial: ProductInitial = {
    id: p.id,
    nameAr: p.name_ar,
    nameEn: p.name_en,
    sku: p.sku,
    brandId: p.brand_id ?? "",
    categoryId: p.category_id ?? "",
    // Private columns must never enter the client bundle for staff
    // lacking cost/supplier permissions — strip them server-side.
    supplierId: canSeeCost ? p.supplier_id ?? "" : "",
    shortDescription: p.short_description,
    description: p.description,
    price: toEgpInput(p.price_amount),
    cost: canSeeCost && p.cost_amount ? toEgpInput(p.cost_amount) : "",
    discountPercent: p.discount_percent,
    stockQuantity: p.stock_quantity,
    lowStockThreshold: p.low_stock_threshold,
    condition: p.condition,
    oemNumber: p.oem_number,
    partNumber: p.part_number,
    altPartNumbers: p.alt_part_numbers.join(", "),
    warranty: p.warranty,
    isReturnable: p.is_returnable,
    isFeatured: p.is_featured,
    status: p.status,
    specsJson: specsText,
    metaTitle: p.meta_title ?? "",
    metaDescription: p.meta_description ?? "",
  };

  const compatEntries: CompatEntry[] = ((compat ?? []) as Array<Record<string, unknown>>).map((row) => {
    const engine = row.engine as {
      year: number;
      name: string;
      displacement_l: string | null;
      model: { name_ar: string; make: { name_ar: string } };
    };
    return {
      engineId: row.engine_id as string,
      label: `${engine.model.make.name_ar} / ${engine.model.name_ar} / ${engine.year} / ${
        engine.displacement_l ? `${engine.name} ${engine.displacement_l}` : engine.name
      }`,
    };
  });

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-1 text-2xs text-ink-400">
        <Link href="/admin/products" className="hover:text-brand-700">المنتجات</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-ink-700">{p.sku}</span>
      </nav>
      <AdminHeader title="تعديل المنتج" subtitle={p.name_ar} />

      <ProductForm
        initial={initial}
        categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name_ar }))}
        brands={(brands ?? []).map((b) => ({ id: b.id, name: b.name_ar }))}
        suppliers={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))}
        canSeeCost={canSeeCost}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ImageManager productId={p.id} images={(images ?? []) as ProductImageRow[]} />
        <CompatibilityManager
          productId={p.id}
          makes={(makes ?? []) as VehicleMakeRow[]}
          initial={compatEntries}
        />
      </div>
    </div>
  );
}
