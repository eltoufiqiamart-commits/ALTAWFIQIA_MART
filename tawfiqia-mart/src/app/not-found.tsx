import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <SearchX className="h-10 w-10" />
      </div>
      <h1 className="text-2xl font-extrabold text-ink-950">الصفحة غير موجودة</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">
        الرابط الذي اتبعته قد يكون قديماً أو غير صحيح. يمكنك العودة للرئيسية أو تصفح المنتجات.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn-primary">الصفحة الرئيسية</Link>
        <Link href="/products" className="btn-outline">كل المنتجات</Link>
      </div>
    </div>
  );
}
