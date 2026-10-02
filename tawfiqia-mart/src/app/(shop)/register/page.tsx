import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "إنشاء حساب جديد", robots: { index: false } };

export default function RegisterPage() {
  return (
    <AuthShell title="إنشاء حساب جديد" subtitle="اطلب وتابع طلباتك بسهولة">
      <RegisterForm />
    </AuthShell>
  );
}
