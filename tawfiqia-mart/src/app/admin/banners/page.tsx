import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader } from "@/components/admin/ui";
import { BannerManager } from "@/components/admin/BannerManager";
import { SectionsManager, type SectionData } from "@/components/admin/SectionsManager";
import type { BannerRow, HomepageSectionRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function BannersAdminPage() {
  const { admin } = await adminPageContext("content.write");
  const [{ data: banners }, { data: sections }, { data: products }] = await Promise.all([
    admin.from("banners").select("*").order("sort_order").order("created_at", { ascending: false }),
    admin.from("homepage_sections").select("*").order("sort_order"),
    admin
      .from("products")
      .select("id, name_ar")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("name_ar")
      .limit(500),
  ]);

  return (
    <div className="space-y-6">
      <AdminHeader title="المحتوى والبانرات" subtitle="بانرات الصفحة الرئيسية وأقسام المنتجات" />

      <section>
        <h2 className="mb-3 text-base font-extrabold">البانرات</h2>
        <BannerManager banners={(banners ?? []) as BannerRow[]} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-extrabold">أقسام الصفحة الرئيسية</h2>
        <SectionsManager
          sections={(sections ?? []) as HomepageSectionRow[] as unknown as SectionData[]}
          options={((products ?? []) as Array<{ id: string; name_ar: string }>).map((p) => ({ id: p.id, name: p.name_ar }))}
        />
      </section>
    </div>
  );
}
