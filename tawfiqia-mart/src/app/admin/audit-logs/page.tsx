import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader, TableWrap, Th, Td } from "@/components/admin/ui";
import { pagedHref } from "@/lib/admin-query";

export const dynamic = "force-dynamic";

interface AuditRow {
  id: number;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  created_at: string;
}

export default async function AuditLogsPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ action?: string; q?: string; page?: string }>;
}) {
  const searchParams = await _searchParams;
  const { admin } = await adminPageContext("audit.view");
  const actionFilter = (searchParams.action ?? "").trim();
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const PER = 50;

  let query: any = admin
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (actionFilter) query = query.eq("action", actionFilter);
  if (q) query = query.or(`action.ilike.%${q.replace(/[%,]/g, "")}%,entity.ilike.%${q.replace(/[%,]/g, "")}%,entity_id.eq.${q.replace(/[%,]/g, "")}`);
  const from = (page - 1) * PER;
  const { data, count } = await query.range(from, from + PER - 1);
  const rows = (data ?? []) as AuditRow[];

  const { data: actorRows } = rows.some((r) => r.actor_id)
    ? await admin.from("profiles").select("id, full_name").in("id", [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[])
    : { data: [] };
  const actorMap = new Map(((actorRows ?? []) as Array<{ id: string; full_name: string }>).map((a) => [a.id, a.full_name]));

  return (
    <div>
      <AdminHeader title="سجل التدقيق" subtitle="سجل غير قابل للتعديل لكل العمليات الإدارية الحساسة" />

      <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-3">
        <input name="q" defaultValue={q} placeholder="إجراء / كيان / معرّف" className="input input-sm" />
        <input name="action" defaultValue={actionFilter} placeholder="مثل: product.update" className="input input-sm" dir="ltr" />
        <button className="btn-outline btn-sm">تصفية</button>
      </form>

      <div className="hidden md:block">
        <TableWrap>
          <thead>
            <tr>
              <Th>الوقت</Th><Th>الإجراء</Th><Th>الكيان</Th><Th>المرجع</Th><Th>بواسطة</Th><Th>تفاصيل</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-2xs">
                  {new Date(r.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                </Td>
                <Td className="font-mono text-2xs font-bold" dir="ltr">{r.action}</Td>
                <Td className="text-2xs">{r.entity}</Td>
                <Td className="max-w-40 truncate font-mono text-2xs" dir="ltr">{r.entity_id ?? "—"}</Td>
                <Td className="text-2xs">{(r.actor_id && actorMap.get(r.actor_id)) || r.actor_role || "نظام"}</Td>
                <Td className="max-w-sm">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words text-2xs text-ink-500">
                    {Object.keys(r.metadata ?? {}).length ? JSON.stringify(r.metadata) : "—"}
                  </pre>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && <tr><Td className="text-center text-ink-400">لا سجلات.</Td></tr>}
          </tbody>
        </TableWrap>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((r) => (
          <div key={r.id} className="card-pad">
            <p className="font-mono text-2xs font-bold" dir="ltr">{r.action}</p>
            <p className="mt-1 text-2xs text-ink-500">
              {new Date(r.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })} —{" "}
              {(r.actor_id && actorMap.get(r.actor_id)) || r.actor_role || "نظام"}
            </p>
            <pre className="mt-1 whitespace-pre-wrap break-words text-2xs text-ink-400">
              {Object.keys(r.metadata ?? {}).length ? JSON.stringify(r.metadata) : ""}
            </pre>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-2 text-xs">
        {page > 1 && <a href={pagedHref("/admin/audit-logs", page - 1, searchParams)} className="btn-outline btn-sm">السابق</a>}
        <span className="py-1.5 text-ink-500">صفحة {page} من {Math.ceil((count ?? 0) / PER)}</span>
        {page < Math.ceil((count ?? 0) / PER) && (
          <a href={pagedHref("/admin/audit-logs", page + 1, searchParams)} className="btn-outline btn-sm">التالي</a>
        )}
      </div>
    </div>
  );
}
