import Link from "next/link";
import { Search, Eye } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader, TableWrap, Th, Td } from "@/components/admin/ui";
import { RoleManager } from "@/components/admin/RoleManager";
import { ROLE_LABELS_AR } from "@/lib/permissions";
import { pagedHref } from "@/lib/admin-query";
import type { ProfileRow, Role } from "@/types/database";

export const dynamic = "force-dynamic";
const PER = 50;

export default async function CustomersAdminPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  const searchParams = await _searchParams;
  const { user, admin } = await adminPageContext("customers.read");
  const canManageRoles = user.profile.role === "super_admin";
  const q = (searchParams.q ?? "").trim();
  const roleFilter = searchParams.role ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);

  let query = admin
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (roleFilter) query = query.eq("role", roleFilter);
  if (q) query = query.or(`full_name.ilike.%${q.replace(/[%,]/g, "")}%,phone.ilike.%${q.replace(/[%,]/g, "")}%`);
  const from = (page - 1) * PER;
  const { data: profiles, count } = await query.range(from, from + PER - 1);
  const rows = (profiles ?? []) as ProfileRow[];

  // Order aggregates per customer.
  const ids = rows.map((r) => r.id);
  const { data: orders } = ids.length
    ? await admin
        .from("orders")
        .select("user_id, grand_total_amount, status")
        .in("user_id", ids)
    : { data: [] };
  const agg = new Map<string, { count: number; total: number }>();
  for (const o of (orders ?? []) as Array<{ user_id: string; grand_total_amount: number; status: string }>) {
    const cur = agg.get(o.user_id) ?? { count: 0, total: 0 };
    cur.count += 1;
    if (!["cancelled"].includes(o.status)) cur.total += o.grand_total_amount;
    agg.set(o.user_id, cur);
  }

  return (
    <div>
      <AdminHeader title="العملاء" subtitle={`${count ?? 0} حساب`} />

      <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input name="q" defaultValue={q} placeholder="الاسم أو الهاتف" className="input input-sm pe-9" />
        </div>
        <select name="role" defaultValue={roleFilter} className="input input-sm">
          <option value="">كل الأدوار</option>
          {Object.entries(ROLE_LABELS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-outline btn-sm">بحث</button>
      </form>

      <div className="hidden md:block">
        <TableWrap>
          <thead>
            <tr>
              <Th>الاسم</Th>
              <Th>الهاتف</Th>
              <Th>الدور</Th>
              <Th>الطلبات</Th>
              <Th>إجمالي المشتريات</Th>
              <Th>آخر دخول</Th>
              <Th>إجراءات</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const a = agg.get(p.id);
              return (
                <tr key={p.id}>
                  <Td className="font-bold">{p.full_name || "—"}</Td>
                  <Td dir="ltr" className="text-xs">{p.phone ?? "—"}</Td>
                  <Td className="text-xs">
                    <span className={p.role === "customer" ? "text-ink-500" : "badge-brand"}>{ROLE_LABELS_AR[p.role as Role]}</span>
                    {!p.is_active && <span className="badge-danger ms-1">موقوف</span>}
                  </Td>
                  <Td>{a?.count ?? 0}</Td>
                  <Td className="font-semibold">{a ? formatEgp(a.total) : "—"}</Td>
                  <Td className="text-2xs whitespace-nowrap">
                    {p.last_login_at ? new Date(p.last_login_at).toLocaleDateString("ar-EG", { dateStyle: "short" }) : "—"}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/customers/${p.id}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50">
                        <Eye className="h-4 w-4" />
                      </Link>
                      {canManageRoles && p.id !== user.profile.id && <RoleManager userId={p.id} role={p.role} active={p.is_active} />}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((p) => {
          const a = agg.get(p.id);
          return (
            <div key={p.id} className="card-pad">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold">{p.full_name || "—"}</p>
                  <p className="text-2xs text-ink-400" dir="ltr">{p.phone ?? ""}</p>
                </div>
                <span className={p.role === "customer" ? "text-2xs text-ink-500" : "badge-brand"}>{ROLE_LABELS_AR[p.role as Role]}</span>
              </div>
              <p className="mt-2 text-2xs">طلبات: {a?.count ?? 0} — {a ? formatEgp(a.total) : "—"}</p>
              <div className="mt-2 flex items-center gap-2">
                <Link href={`/admin/customers/${p.id}`} className="btn-outline btn-sm">عرض</Link>
                {canManageRoles && p.id !== user.profile.id && <RoleManager userId={p.id} role={p.role} active={p.is_active} />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-center gap-2 text-xs">
        {page > 1 && <Link href={pagedHref("/admin/customers", page - 1, searchParams)} className="btn-outline btn-sm">السابق</Link>}
        <span className="py-1.5 text-ink-500">صفحة {page} من {Math.ceil((count ?? 0) / PER)}</span>
        {page < Math.ceil((count ?? 0) / PER) && (
          <Link href={pagedHref("/admin/customers", page + 1, searchParams)} className="btn-outline btn-sm">التالي</Link>
        )}
      </div>
    </div>
  );
}

function formatEgp(piastres: number) {
  return `${(piastres / 100).toLocaleString("ar-EG", { maximumFractionDigits: 0 })} ج.م`;
}
