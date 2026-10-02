import Link from "next/link";
import { Search, Phone, MessageSquare } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader, TableWrap, Th, Td, StatusBadge } from "@/components/admin/ui";
import { MessageActions } from "@/components/admin/MessageActions";

export const dynamic = "force-dynamic";
const PER = 50;

interface ContactMessage {
  id: string;
  name: string;
  phone: string;
  message: string;
  is_handled: boolean;
  created_at: string;
}

export default async function MessagesInboxPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const searchParams = await _searchParams;
  const { admin } = await adminPageContext("customers.read");
  const q = (searchParams.q ?? "").trim();
  const status = searchParams.status ?? "open";
  const page = Math.max(1, Number(searchParams.page) || 1);

  let query = admin
    .from("contact_messages")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (status === "open") query = query.eq("is_handled", false);
  if (status === "handled") query = query.eq("is_handled", true);
  if (q) {
    const term = q.replace(/[%,]/g, "");
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,message.ilike.%${term}%`);
  }
  const from = (page - 1) * PER;
  const { data, count } = await query.range(from, from + PER - 1);
  const messages = (data ?? []) as ContactMessage[];

  const tabs = [
    { id: "open", label: "غير مُرد عليها" },
    { id: "handled", label: "تم الرد" },
    { id: "all", label: "الكل" },
  ];

  return (
    <div>
      <AdminHeader title="رسائل التواصل" subtitle="رسائل صفحة اتصل بنا" />

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/admin/messages${t.id === "open" ? "" : `?status=${t.id}`}`}
            className={`btn-sm ${status === t.id ? "btn-primary" : "btn-outline"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form className="card mb-4 flex flex-wrap gap-2 p-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input name="q" defaultValue={q} placeholder="اسم أو هاتف أو نص الرسالة" className="input input-sm pe-9" />
          {status !== "open" && <input type="hidden" name="status" value={status} />}
        </div>
        <button className="btn-outline btn-sm">بحث</button>
      </form>

      <div className="hidden md:block">
        <TableWrap>
          <thead>
            <tr>
              <Th>العميل</Th>
              <Th>الرسالة</Th>
              <Th>التاريخ</Th>
              <Th>الحالة</Th>
              <Th>إجراء</Th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id} className={m.is_handled ? "opacity-60" : ""}>
                <Td>
                  <p className="font-bold">{m.name}</p>
                  <a href={`tel:${m.phone}`} className="flex items-center gap-1 text-2xs text-brand-700" dir="ltr">
                    <Phone className="h-3 w-3" /> {m.phone}
                  </a>
                </Td>
                <Td className="max-w-md text-xs whitespace-normal">{m.message}</Td>
                <Td className="whitespace-nowrap text-2xs">
                  {new Date(m.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                </Td>
                <Td>
                  <StatusBadge tone={m.is_handled ? "neutral" : "warning"}>
                    {m.is_handled ? "تم الرد" : "مفتوحة"}
                  </StatusBadge>
                </Td>
                <Td>
                  <MessageActions id={m.id} handled={m.is_handled} />
                </Td>
              </tr>
            ))}
            {messages.length === 0 && (
              <tr><Td className="py-10 text-center text-ink-400">لا رسائل.</Td></tr>
            )}
          </tbody>
        </TableWrap>
      </div>

      <div className="space-y-2 md:hidden">
        {messages.map((m) => (
          <div key={m.id} className={`card-pad ${m.is_handled ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  <MessageSquare className="h-4 w-4 text-brand-600" />
                  {m.name}
                </p>
                <a href={`tel:${m.phone}`} className="text-2xs text-brand-700" dir="ltr">{m.phone}</a>
              </div>
              <StatusBadge tone={m.is_handled ? "neutral" : "warning"}>{m.is_handled ? "تم الرد" : "مفتوحة"}</StatusBadge>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-xs text-ink-700">{m.message}</p>
            <p className="mt-1 text-2xs text-ink-400">
              {new Date(m.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
            </p>
            <div className="mt-2">
              <MessageActions id={m.id} handled={m.is_handled} />
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="card-pad text-center text-sm text-ink-400">لا رسائل.</p>}
      </div>

      <div className="mt-4 flex justify-center gap-2 text-xs">
        {page > 1 && <Link href={`/admin/messages?page=${page - 1}${status !== "open" ? `&status=${status}` : ""}`} className="btn-outline btn-sm">السابق</Link>}
        <span className="py-1.5 text-ink-500">صفحة {page} من {Math.ceil((count ?? 0) / PER)}</span>
        {page < Math.ceil((count ?? 0) / PER) && (
          <Link href={`/admin/messages?page=${page + 1}${status !== "open" ? `&status=${status}` : ""}`} className="btn-outline btn-sm">التالي</Link>
        )}
      </div>
    </div>
  );
}
