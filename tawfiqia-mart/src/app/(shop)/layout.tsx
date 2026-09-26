import { Header } from "@/components/layout/Header";
import { CategoryNav } from "@/components/layout/CategoryNav";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { ContactFloat } from "@/components/layout/ContactFloat";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <CategoryNav />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <Footer />
      <MobileTabBar />
      <ContactFloat />
    </div>
  );
}
