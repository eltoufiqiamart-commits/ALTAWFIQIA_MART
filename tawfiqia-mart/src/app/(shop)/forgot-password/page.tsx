import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/ForgotForm";

export const metadata: Metadata = { title: "استعادة كلمة المرور", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="استعادة كلمة المرور" subtitle="أدخل بريدك الإلكتروني وسنرسل رابط الاستعادة">
      <ForgotForm />
    </AuthShell>
  );
}
