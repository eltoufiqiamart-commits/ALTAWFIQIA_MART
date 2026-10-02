import type { Metadata } from "next";
import { getVehicleMakes } from "@/lib/server/catalog";
import { VehicleFinder } from "@/components/catalog/VehicleFinder";

export const metadata: Metadata = {
  title: "البحث بموديل السيارة",
  description: "اعثر على قطع الغيار المتوافقة مع سيارتك عبر اختيار الماركة والموديل والسنة والمحرك.",
};
export const revalidate = 300;

export default async function VehiclesPage() {
  const makes = await getVehicleMakes();
  return (
    <div className="shell section">
      <h1 className="mb-5 text-xl font-extrabold text-ink-950 md:text-2xl">البحث بموديل السيارة</h1>
      <VehicleFinder makes={makes} />
    </div>
  );
}
