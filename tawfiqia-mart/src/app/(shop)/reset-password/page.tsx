import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "إعادة تعيين كلمة المرور", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="كلمة مرور جديدة" subtitle="اختر كلمة مرور قوية جديدة لحسابك">
      <ResetPasswordForm />
    </AuthShell>
  );
}
