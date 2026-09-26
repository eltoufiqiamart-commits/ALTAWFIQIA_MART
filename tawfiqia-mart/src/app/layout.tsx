import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "@/styles/globals.css";
import Providers from "@/components/providers/Providers";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tawfiqia-mart.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "التوفيقية مارت | قطع غيار السيارات لكل الموديلات",
    template: "%s | التوفيقية مارت",
  },
  description:
    "اطلب قطع غيار سيارتك الأصلية والبديلة بثقة: زيوت، فلاتر، فرامل، كهرباء والمزيد، مع توصيل سريع لكل محافظات مصر ودفع عند الاستلام.",
  applicationName: "التوفيقية مارت",
  keywords: ["قطع غيار سيارات", "قطع غيار", "فلاتر", "زيوت سيارات", "فرامل", "التوفيقية"],
  authors: [{ name: "VELIX AI", url: "https://web-3-velix-ai.vercel.app/" }],
  icons: {
    icon: "/brand/icon-512.jpg",
    apple: "/brand/apple-icon.png",
  },
  openGraph: {
    siteName: "التوفيقية مارت",
    locale: "ar_EG",
    type: "website",
    title: "التوفيقية مارت | قطع غيار السيارات",
    description: "Quality Auto Parts • For Every Ride — قطع غيار موثوقة لكل رحلة",
    images: [{ url: "/brand/og.jpg", width: 1200, height: 630, alt: "التوفيقية مارت" }],
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
  },
};

export const viewport: Viewport = {
  themeColor: "#146BFD",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="min-h-screen bg-ink-50 text-ink-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
