import Link from "next/link";
import { Star } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader, TableWrap, Th, Td, StatusBadge } from "@/components/admin/ui";
import { ReviewModeration } from "@/components/admin/ReviewModeration";
import type { ReviewRow, ProductRow, ProfileRow } from "@/types/database";

export const dynamic = "force-dynamic";

const STATUS_AR: Record<string, string> = { pending: "بانتظار الاعتماد", approved: "منشور", hidden: "مخفي" };
const STATUS_TONE: Record<string, "warning" | "success" | "neutral"> = {
  pending: "warning",
  approved: "success",
  hidden: "neutral",
};

export default async function ReviewsAdminPage({ searchParams: _searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await _searchParams;
  const { admin } = await adminPageContext("products.write");
  const status = searchParams.status ?? "pending";

  let query = admin
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  const { data: reviews } = await query.limit(100);
  const rows = (reviews ?? []) as ReviewRow[];

  const productIds = [...new Set(rows.map((r) => r.product_id))];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: products }, { data: users }] = await Promise.all([
    productIds.length ? admin.from("products").select("id, name_ar, slug").in("id", productIds) : { data: [] },
    userIds.length ? admin.from("profiles").select("id, full_name").in("id", userIds) : { data: [] },
  ]);
  const productMap = new Map(((products ?? []) as Pick<ProductRow, "id" | "name_ar" | "slug">[]).map((p) => [p.id, p]));
  const userMap = new Map(((users ?? []) as Pick<ProfileRow, "id" | "full_name">[]).map((u) => [u.id, u]));

  return (
    <div>
      <AdminHeader title="التقييمات" subtitle="تظهر للعملاء التقييمات المعتمدة فقط، ومن مشترين موثّقين حصرًا" />

      <div className="mb-4 flex gap-2 text-xs">
        {(["pending", "approved", "hidden", "all"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/reviews${s === "all" ? "?status=all" : s === "pending" ? "" : `?status=${s}`}`}
            className={`btn-sm ${status === s ? "btn-primary" : "btn-outline"}`}
          >
            {s === "all" ? "الكل" : STATUS_AR[s]}
          </Link>
        ))}
      </div>

      <div className="hidden md:block">
        <TableWrap>
          <thead>
            <tr>
              <Th>المنتج</Th><Th>العميل</Th><Th>التقييم</Th><Th>التعليق</Th><Th>الحالة</Th><Th>إجراءات</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="max-w-48">
                  <Link href={`/admin/products/${r.product_id}`} className="text-xs font-bold hover:text-brand-700">
                    {productMap.get(r.product_id)?.name_ar ?? "منتج محذوف"}
                  </Link>
                </Td>
                <Td className="text-xs">{userMap.get(r.user_id)?.full_name ?? "—"}</Td>
                <Td>
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-accent-400 text-accent-400" : "text-ink-200"}`} />
                    ))}
                  </span>
                </Td>
                <Td className="max-w-sm text-2xs text-ink-600">{r.comment}</Td>
                <Td><StatusBadge tone={STATUS_TONE[r.status]}>{STATUS_AR[r.status]}</StatusBadge></Td>
                <Td><ReviewModeration id={r.id} status={r.status} /></Td>
              </tr>
            ))}
            {rows.length === 0 && <tr><Td className="text-center text-ink-400">لا توجد تقييمات.</Td></tr>}
          </tbody>
        </TableWrap>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((r) => (
          <div key={r.id} className="card-pad space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-accent-400 text-accent-400" : "text-ink-200"}`} />
                ))}
              </span>
              <StatusBadge tone={STATUS_TONE[r.status]}>{STATUS_AR[r.status]}</StatusBadge>
            </div>
            <p className="text-xs font-bold">{productMap.get(r.product_id)?.name_ar}</p>
            <p className="text-2xs text-ink-600">{r.comment}</p>
            <ReviewModeration id={r.id} status={r.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
