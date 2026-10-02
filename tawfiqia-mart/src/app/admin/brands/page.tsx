import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader } from "@/components/admin/ui";
import { TaxonomyManager } from "@/components/admin/TaxonomyManager";

export const dynamic = "force-dynamic";

export default async function BrandsAdminPage() {
  const { admin } = await adminPageContext("brands.write");
  const { data } = await admin
    .from("brands")
    .select("id, name_ar, name_en, description, deleted_at")
    .order("name_ar");

  return (
    <div>
      <AdminHeader title="الماركات" subtitle="ماركات قطع الغيار والسيارات" />
      <TaxonomyManager
        kind="brands"
        noun="ماركة"
        hasDescription
        items={(data ?? []) as Array<{ id: string; name_ar: string; name_en: string; description: string; deleted_at: string | null }>}
      />
    </div>
  );
}
