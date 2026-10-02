import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "تسجيل الدخول", robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthShell title="تسجيل الدخول" subtitle="أهلاً بعودتك إلى التوفيقية مارت" footer={<span>عميل جديد؟ </span>}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
