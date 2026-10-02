import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { permissionsForRole, ROLE_LABELS_AR } from "@/lib/permissions";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata = {
  title: "لوحة التحكم",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  const permissions = permissionsForRole(user.profile.role);
  if (!permissions.includes("dashboard.view")) redirect("/403");

  return (
    <div className="flex min-h-screen bg-ink-100">
      <AdminNav permissions={permissions} roleLabel={ROLE_LABELS_AR[user.profile.role]} />
      <div className="min-w-0 flex-1">
        <main className="p-4 md:p-7">{children}</main>
      </div>
    </div>
  );
}
