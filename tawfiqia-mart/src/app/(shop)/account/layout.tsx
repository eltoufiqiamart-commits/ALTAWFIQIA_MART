import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { AccountNav } from "@/components/account/AccountNav";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const sb = await createClient();
  const { count: unread } = await sb
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return (
    <div className="shell section">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-ink-950 md:text-2xl">حسابي</h1>
        <p className="mt-0.5 text-sm text-ink-500">أهلًا، {user.profile.full_name || "عميل التوفيقية"}</p>
      </div>
      <div className="mb-5 md:hidden">
        <AccountNav unreadCount={unread ?? 0} />
      </div>
      <div className="flex gap-6">
        <div className="hidden md:block">
          <AccountNav unreadCount={unread ?? 0} />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
