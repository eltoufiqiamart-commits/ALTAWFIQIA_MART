import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkAllRead } from "@/components/account/MarkAllRead";
import { NotificationLink } from "@/components/account/NotificationLink";

export const metadata: Metadata = { title: "الإشعارات", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = (await getCurrentUser())!;
  const sb = await createClient();
  const { data } = await sb
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data || data.length === 0) {
    return <EmptyState icon={Bell} title="لا توجد إشعارات" description="ستظهر هنا تحديثات طلباتك والدفع." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <MarkAllRead />
      </div>
      <ul className="card divide-y divide-ink-100">
        {data.map((n) => {
          const time = (
            <p className="mt-1 text-2xs text-ink-400">
              {new Date(n.created_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          );
          return (
            <li key={n.id} className={`p-4 ${n.is_read ? "" : "bg-brand-50/50"}`}>
              {n.link ? (
                <NotificationLink id={n.id} href={n.link} unread={!n.is_read}>
                  <p className="text-sm font-bold text-ink-900">
                    {!n.is_read && <span className="ms-1 inline-block h-2 w-2 rounded-full bg-accent-600 align-middle" />}
                    {n.title}
                  </p>
                  {n.body && <p className="mt-0.5 text-sm text-ink-600">{n.body}</p>}
                  {time}
                </NotificationLink>
              ) : (
                <>
                  <p className="text-sm font-bold text-ink-900">
                    {!n.is_read && <span className="ms-1 inline-block h-2 w-2 rounded-full bg-accent-600 align-middle" />}
                    {n.title}
                  </p>
                  {n.body && <p className="mt-0.5 text-sm text-ink-600">{n.body}</p>}
                  {time}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
