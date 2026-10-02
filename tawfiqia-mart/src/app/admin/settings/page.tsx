import { Lock, Truck, Wallet, Info } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader } from "@/components/admin/ui";
import { ShippingTable } from "@/components/admin/ShippingTable";
import { BUSINESS } from "@/lib/constants";
import type { ShippingRuleRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SettingsAdminPage() {
  const { admin } = await adminPageContext("settings.write");
  const { data: rules } = await admin
    .from("shipping_rules")
    .select("*")
    .order("is_active", { ascending: false })
    .order("governorate");
  const { data: pricing } = await admin
    .from("business_settings")
    .select("key, value")
    .eq("key", "pricing")
    .maybeSingle();

  const p = (pricing?.value ?? {}) as {
    codFeeBps?: number;
    prepaidTiers?: Array<{ upToExclusive: number | null; bps: number }>;
    defaultShippingFee?: number;
  };

  return (
    <div className="space-y-5">
      <AdminHeader title="الإعدادات والشحن" subtitle="قيم الشحن قابلة للتعديل، وسياسات الخصم ثابتة بقرار الإدارة ولا يمكن تجاوزها" />

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
          <Truck className="h-4 w-4 text-brand-600" /> رسوم الشحن والمواعيد حسب المحافظة
        </h2>
        <ShippingTable rules={(rules ?? []) as ShippingRuleRow[]} />
      </section>

      <section className="card-pad space-y-3">
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          <Lock className="h-4 w-4 text-brand-600" /> سياسات التسعير (للقراءة فقط)
        </h2>
        <div className="grid gap-3 text-xs sm:grid-cols-3">
          <div className="rounded-xl bg-ink-50 p-3">
            <p className="font-bold text-ink-700">رسوم الدفع عند الاستلام</p>
            <p className="mt-1 text-lg font-extrabold">{((p.codFeeBps ?? 100) / 100).toFixed(0)}%</p>
            <p className="text-2xs text-ink-400">تُحسب خادميًا على كل طلبية COD</p>
          </div>
          {(p.prepaidTiers ?? []).map((t, i) => (
            <div key={i} className="rounded-xl bg-ink-50 p-3">
              <p className="font-bold text-ink-700">
                خصم الدفع المسبق {t.upToExclusive ? `أقل من ${t.upToExclusive / 100} ج.م` : `${3000} ج.م فأكثر`}
              </p>
              <p className="mt-1 text-lg font-extrabold text-success">{(t.bps / 100).toFixed(0)}%</p>
            </div>
          ))}
        </div>
        <p className="flex items-start gap-1.5 rounded-xl bg-warningBg p-2 text-2xs font-semibold text-warning">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          تعديل هذه النسب يتطلب تغييرًا مباشرًا من قاعدة البيانات بقرار إداري موثّق، لضمان عدم تجاوز سقف 3% / 5% أو رسوم 1%.
        </p>
      </section>

      <section className="card-pad space-y-2 text-xs">
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          <Wallet className="h-4 w-4 text-brand-600" /> حسابات التحصيل المعتمدة
        </h2>
        <ul className="space-y-1.5 text-ink-700" dir="ltr">
          <li>Vodafone Cash: <b>{BUSINESS.vodafoneCash}</b></li>
          <li>InstaPay: <b>{BUSINESS.instapay}</b></li>
          <li>Tella / Fawry & WhatsApp: <b>{BUSINESS.tellaFawry}</b></li>
        </ul>
      </section>
    </div>
  );
}
