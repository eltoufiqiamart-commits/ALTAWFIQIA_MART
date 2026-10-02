import Link from "next/link";
import { Plus, Phone, Pencil, Lock } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { roleCan } from "@/lib/permissions";
import { AdminHeader, TableWrap, Th, Td, StatusBadge } from "@/components/admin/ui";
import { SupplierForm } from "@/components/admin/SupplierForm";
import type { SupplierRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SuppliersAdminPage({ searchParams: _searchParams }: { searchParams: Promise<{ new?: string; edit?: string }> }) {
  const searchParams = await _searchParams;
  const { user, admin } = await adminPageContext("suppliers.read");
  const canWrite = roleCan(user.profile.role, "suppliers.write");
  const canSeeCost = roleCan(user.profile.role, "products.cost.view");

  const { data: suppliers } = await admin
    .from("suppliers")
    .select("*")
    .order("deleted_at", { ascending: true })
    .order("name");
  const rows = (suppliers ?? []) as SupplierRow[];

  // Product counts are visible to any supplier-reader; stock COST VALUE is a
  // private figure selected only for roles holding products.cost.view.
  const { data: products } = await admin
    .from("products")
    .select(canSeeCost ? "id, supplier_id, cost_amount, stock_quantity" : "id, supplier_id")
    .not("supplier_id", "is", null);
  const bySupplier = new Map<string, { count: number; stockCost: number }>();
  for (const p of (products ?? []) as Array<{ supplier_id: string | null; cost_amount?: number; stock_quantity?: number }>) {
    if (!p.supplier_id) continue;
    const cur = bySupplier.get(p.supplier_id) ?? { count: 0, stockCost: 0 };
    cur.count += 1;
    if (canSeeCost) cur.stockCost += (p.cost_amount ?? 0) * (p.stock_quantity ?? 0);
    bySupplier.set(p.supplier_id, cur);
  }

  const editing = searchParams.edit ? rows.find((s) => s.id === searchParams.edit) ?? null : null;
  const isNew = searchParams.new === "1" && canWrite;

  return (
    <div>
      <AdminHeader
        title="المورّدون (بيانات خاصة)"
        subtitle="الهواتف والتكلفة لا تظهر للعملاء بأي شكل"
        action={
          canWrite && !isNew && !editing ? (
            <Link href="/admin/suppliers?new=1" className="btn-primary btn-sm">
              <Plus className="h-4 w-4" /> مورّد جديد
            </Link>
          ) : canWrite ? (
            <Link href="/admin/suppliers" className="btn-outline btn-sm">رجوع</Link>
          ) : null
        }
      />

      <div className="mb-3 flex items-center gap-1.5 rounded-xl bg-ink-100 px-3 py-2 text-2xs font-semibold text-ink-600">
        <Lock className="h-3.5 w-3.5" /> صفحة محمية: لا تُصدَّر للواجهة ولا تُضمَّن في أي استعلام عام.
      </div>

      {(isNew || editing) && canWrite && (
        <div className="mb-4">
          <SupplierForm supplier={editing} />
        </div>
      )}

      {!isNew && !editing && (
        <>
          <div className="hidden md:block">
            <TableWrap>
              <thead>
                <tr>
                  <Th>المورّد</Th><Th>الهاتف</Th><Th>العنوان</Th><Th>عدد المنتجات</Th>
                  {canSeeCost && <Th>تكلفة المخزون الحالي</Th>}<Th>الحالة</Th>{canWrite && <Th></Th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const stats = bySupplier.get(s.id);
                  return (
                    <tr key={s.id} className={s.deleted_at ? "opacity-60" : ""}>
                      <Td>
                        <p className="font-bold">{s.name}</p>
                        <p className="text-2xs text-ink-400">{s.shop_name}</p>
                      </Td>
                      <Td dir="ltr" className="text-xs">
                        <a href={`tel:${s.phone}`} className="flex items-center gap-1 hover:text-brand-700">
                          <Phone className="h-3 w-3" /> {s.phone}
                        </a>
                        {s.alt_phone && <span className="text-ink-400">{s.alt_phone}</span>}
                      </Td>
                      <Td className="max-w-52 truncate text-2xs">{s.address || "—"}</Td>
                      <Td>{stats?.count ?? 0}</Td>
                      {canSeeCost && <Td className="font-semibold">{formatEgp(stats?.stockCost ?? 0)}</Td>}
                      <Td>
                        <StatusBadge tone={s.is_active && !s.deleted_at ? "success" : "neutral"}>
                          {s.is_active && !s.deleted_at ? "نشط" : "موقوف"}
                        </StatusBadge>
                      </Td>
                      {canWrite && (
                        <Td>
                          <Link href={`/admin/suppliers?edit=${s.id}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50">
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Td>
                      )}
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><Td className="text-center text-ink-400">لا يوجد مورّدون بعد.</Td></tr>}
              </tbody>
            </TableWrap>
          </div>

          <div className="space-y-2 md:hidden">
            {rows.map((s) => {
              const stats = bySupplier.get(s.id);
              return (
                <div key={s.id} className="card-pad">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-extrabold">{s.name}</p>
                    <StatusBadge tone={s.is_active && !s.deleted_at ? "success" : "neutral"}>
                      {s.is_active && !s.deleted_at ? "نشط" : "موقوف"}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-2xs" dir="ltr">{s.phone}</p>
                  <p className="mt-1 text-2xs text-ink-500">
                    {stats?.count ?? 0} منتج
                    {canSeeCost && ` — تكلفة مخزون ${formatEgp(stats?.stockCost ?? 0)}`}
                  </p>
                  {canWrite && (
                    <Link href={`/admin/suppliers?edit=${s.id}`} className="btn-outline btn-sm mt-2">تعديل</Link>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function formatEgp(piastres: number) {
  return `${(piastres / 100).toLocaleString("ar-EG", { maximumFractionDigits: 0 })} ج.م`;
}
