import type { Metadata } from "next";
import { Phone, Mail, MessageCircle } from "lucide-react";
import { ContactForm } from "@/components/info/ContactForm";
import { BUSINESS, whatsappLink } from "@/lib/constants";

export const metadata: Metadata = {
  title: "اتصل بنا",
  description: "تواصل مع التوفيقية مارت عبر واتساب أو الهاتف أو البريد الإلكتروني.",
};

export default function ContactPage() {
  return (
    <div className="shell section grid gap-6 md:grid-cols-2">
      <div>
        <h1 className="text-xl font-extrabold text-ink-950 md:text-2xl">اتصل بنا</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          فريقنا جاهز لمساعدتك في تحديد القطعة الصحيحة ومتابعة طلبك. تواصل عبر أي من القنوات التالية.
        </p>
        <div className="mt-6 space-y-3">
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="card-pad flex items-center gap-3 transition hover:border-[#25D366]/50"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/10 text-[#1da851]">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold text-ink-900">واتساب / اتصال</span>
              <span className="text-sm text-ink-500" dir="ltr">{BUSINESS.whatsapp}</span>
            </span>
          </a>
          <a href={`tel:${BUSINESS.whatsapp}`} className="card-pad flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Phone className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold text-ink-900">الهاتف</span>
              <span className="text-sm text-ink-500" dir="ltr">{BUSINESS.whatsapp}</span>
            </span>
          </a>
          <a href={`mailto:${BUSINESS.email}`} className="card-pad flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <Mail className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink-900">البريد الإلكتروني</span>
              <span className="block truncate text-sm text-ink-500" dir="ltr">{BUSINESS.email}</span>
            </span>
          </a>
        </div>
        <div className="card-pad mt-6">
          <h2 className="text-sm font-extrabold text-ink-950">أوقات الرد</h2>
          <p className="mt-1 text-sm text-ink-600">
            يتم الرد على الرسائل يوميًا خلال ساعات العمل، وقد تختلف استجابة التحويلات المالية في
            مواعيد المساء.
          </p>
        </div>
      </div>
      <ContactForm />
    </div>
  );
}
