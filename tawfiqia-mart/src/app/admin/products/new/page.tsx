import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { roleCan } from "@/lib/permissions";
import { ProductForm, EMPTY_PRODUCT } from "@/components/admin/ProductForm";
import { AdminHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const { user, admin } = await adminPageContext("products.write");
  const canSeeCost = roleCan(user.profile.role, "products.cost.view");
  const [{ data: categories }, { data: brands }, { data: suppliers }] = await Promise.all([
    admin
      .from("categories")
      .select("id, name_ar")
      .is("deleted_at", null)
      .order("sort_order"),
    admin.from("brands").select("id, name_ar").is("deleted_at", null).order("name_ar"),
    canSeeCost
      ? admin.from("suppliers").select("id, name").is("deleted_at", null).eq("is_active", true)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div>
      <nav className="mb-2 flex items-center gap-1 text-2xs text-ink-400">
        <Link href="/admin/products" className="hover:text-brand-700">المنتجات</Link>
        <ChevronRight className="h-3 w-3" />
        <span>جديد</span>
      </nav>
      <AdminHeader title="منتج جديد" subtitle="احفظ المنتج أولًا ثم أضف الصور والتوافق من صفحته" />
      <ProductForm
        initial={EMPTY_PRODUCT}
        categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name_ar }))}
        brands={(brands ?? []).map((b) => ({ id: b.id, name: b.name_ar }))}
        suppliers={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))}
        canSeeCost={canSeeCost}
      />
    </div>
  );
}
