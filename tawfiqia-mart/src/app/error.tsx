"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Technical detail stays server-side/client logs; never shown to customers.
    console.error("[app-error]", error?.message);
  }, [error]);

  return (
    <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-warningBg text-warning">
        <AlertTriangle className="h-10 w-10" />
      </div>
      <h1 className="text-2xl font-extrabold text-ink-950">حدث خطأ غير متوقع</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">
        برجاء المحاولة مرة أخرى. إذا استمرت المشكلة، تواصل معنا وسنساعدك فورًا.
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn-primary">إعادة المحاولة</button>
        <Link href="/" className="btn-outline">الرئيسية</Link>
      </div>
    </div>
  );
}
