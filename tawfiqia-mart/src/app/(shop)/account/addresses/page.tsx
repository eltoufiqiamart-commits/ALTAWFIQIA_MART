import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { AddressBook } from "@/components/account/AddressBook";
import type { AddressRow } from "@/types/database";

export const metadata: Metadata = { title: "العناوين المحفوظة", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const user = (await getCurrentUser())!;
  const sb = await createClient();
  const { data } = await sb
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at");
  return <AddressBook addresses={(data ?? []) as AddressRow[]} />;
}
