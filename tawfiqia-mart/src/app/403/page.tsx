import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const metadata = { title: "غير مصرح", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-dangerBg text-danger">
        <ShieldAlert className="h-10 w-10" />
      </div>
      <h1 className="text-2xl font-extrabold text-ink-950">غير مصرح لك بالدخول</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">
        لا تملك صلاحية لعرض هذه الصفحة. إذا كنت تعتقد بوجود خطأ، تواصل مع إدارة المتجر.
      </p>
      <Link href="/" className="btn-primary mt-6">الصفحة الرئيسية</Link>
    </div>
  );
}
