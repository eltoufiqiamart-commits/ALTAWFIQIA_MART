import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import type { AddressRow } from "@/types/database";

export const metadata: Metadata = { title: "إتمام الطلب", robots: { index: false } };

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");
  const sb = await createClient();
  const { data } = await sb
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  return <CheckoutView savedAddresses={(data ?? []) as AddressRow[]} />;
}
