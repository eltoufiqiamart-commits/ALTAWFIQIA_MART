import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/server/auth";
import { ProfileForm } from "@/components/account/ProfileForm";

export const metadata: Metadata = { title: "البيانات الشخصية", robots: { index: false } };

export default async function ProfilePage() {
  const user = (await getCurrentUser())!;
  return (
    <ProfileForm
      initial={{ fullName: user.profile.full_name, phone: user.profile.phone ?? "" }}
      email={user.email ?? ""}
    />
  );
}
