import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader } from "@/components/admin/ui";
import { TaxonomyManager } from "@/components/admin/TaxonomyManager";

export const dynamic = "force-dynamic";

export default async function CategoriesAdminPage() {
  const { admin } = await adminPageContext("categories.write");
  const { data } = await admin
    .from("categories")
    .select("id, name_ar, name_en, description, deleted_at")
    .order("sort_order")
    .order("name_ar");

  return (
    <div>
      <AdminHeader title="الأقسام" subtitle="الأقسام المؤرشفة لا تظهر للعملاء، والمنتجات المرتبطة بها تُحفظ" />
      <TaxonomyManager
        kind="categories"
        noun="قسم"
        hasDescription
        items={(data ?? []) as Array<{ id: string; name_ar: string; name_en: string; description: string; deleted_at: string | null }>}
      />
    </div>
  );
}
