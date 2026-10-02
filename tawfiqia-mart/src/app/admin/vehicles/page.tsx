import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader } from "@/components/admin/ui";
import { VehicleManager } from "@/components/admin/VehicleManager";
import type { VehicleMakeRow, VehicleModelRow, VehicleEngineRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function VehiclesAdminPage() {
  const { admin } = await adminPageContext("vehicles.write");
  const [{ data: makes }, { data: models }, { data: engines }] = await Promise.all([
    admin.from("vehicle_makes").select("*").eq("is_active", true).order("sort_order").order("name_ar"),
    admin.from("vehicle_models").select("*").eq("is_active", true).order("name_ar"),
    admin.from("vehicle_engines").select("*").order("year", { ascending: false }),
  ]);

  return (
    <div>
      <AdminHeader
        title="السيارات والتوافق"
        subtitle="شجرة الماركة → الموديل → سنة الصنع → المحرك، وتُربط المنتجات بالمحركات"
      />
      <VehicleManager
        makes={(makes ?? []) as VehicleMakeRow[]}
        models={(models ?? []) as VehicleModelRow[]}
        engines={(engines ?? []) as VehicleEngineRow[]}
      />
    </div>
  );
}
