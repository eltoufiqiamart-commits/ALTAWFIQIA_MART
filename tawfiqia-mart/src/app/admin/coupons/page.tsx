import Link from "next/link";
import { Plus } from "lucide-react";
import { adminPageContext } from "@/lib/server/admin/guard";
import { AdminHeader, TableWrap, Th, Td, StatusBadge } from "@/components/admin/ui";
import { CouponForm } from "@/components/admin/CouponForm";
import { formatPrice } from "@/lib/money";
import type { CouponRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function CouponsAdminPage({ searchParams: _searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const searchParams = await _searchParams;
  const { admin } = await adminPageContext("coupons.write");
  const { data: coupons } = await admin
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  const rows = (coupons ?? []) as CouponRow[];
  const editing = searchParams.edit ? rows.find((c) => c.id === searchParams.edit) ?? null : null;
  const isNew = searchParams.new === "1";

  return (
    <div>
      <AdminHeader
        title="الكوبونات"
        subtitle="التحقق والحد الأقصى للخصم يُفرضان من خادم التسعير"
        action={
          !isNew && !editing ? (
            <Link href="/admin/coupons?new=1" className="btn-primary btn-sm">
              <Plus className="h-4 w-4" /> كوبون جديد
            </Link>
          ) : (
            <Link href="/admin/coupons" className="btn-outline btn-sm">رجوع للقائمة</Link>
          )
        }
      />

      {(isNew || editing) && (
        <div className="mb-4">
          <CouponForm coupon={editing} />
        </div>
      )}

      {!isNew && !editing && (
        <>
          <div className="hidden md:block">
            <TableWrap>
              <thead>
                <tr>
                  <Th>الكود</Th><Th>النوع</Th><Th>القيمة</Th><Th>أدنى طلب</Th>
                  <Th>الاستخدام</Th><Th>الفترة</Th><Th>الحالة</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-extrabold" dir="ltr">{c.code}</Td>
                    <Td className="text-xs">{c.type === "percentage" ? "نسبة %" : "ثابت"}</Td>
                    <Td className="font-semibold">
                      {c.type === "percentage" ? `${c.value / 100}%` : formatPrice(c.value)}
                      {c.max_discount_amount ? <span className="block text-2xs text-ink-400">بحد {formatPrice(c.max_discount_amount)}</span> : null}
                    </Td>
                    <Td className="text-xs">{c.min_order_amount ? formatPrice(c.min_order_amount) : "بدون حد"}</Td>
                    <Td className="text-xs">
                      {c.used_count}{c.total_usage_limit ? ` / ${c.total_usage_limit}` : ""}
                      <span className="block text-2xs text-ink-400">{c.per_user_limit} لكل عميل</span>
                    </Td>
                    <Td className="text-2xs">
                      {c.starts_at ? new Date(c.starts_at).toLocaleDateString("ar-EG") : "—"}
                      {" ← "}
                      {c.ends_at ? new Date(c.ends_at).toLocaleDateString("ar-EG") : "مفتوح"}
                    </Td>
                    <Td>
                      <StatusBadge tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "نشط" : "متوقف"}</StatusBadge>
                    </Td>
                    <Td>
                      <Link href={`/admin/coupons?edit=${c.id}`} className="btn-outline btn-sm">تعديل</Link>
                    </Td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><Td className="text-center text-ink-400">لا توجد كوبونات بعد.</Td></tr>
                )}
              </tbody>
            </TableWrap>
          </div>

          <div className="space-y-2 md:hidden">
            {rows.map((c) => (
              <div key={c.id} className="card-pad">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold" dir="ltr">{c.code}</span>
                  <StatusBadge tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "نشط" : "متوقف"}</StatusBadge>
                </div>
                <p className="mt-1 text-2xs text-ink-500">
                  {c.type === "percentage" ? `${c.value / 100}%` : formatPrice(c.value)} — استخدام {c.used_count}
                </p>
                <Link href={`/admin/coupons?edit=${c.id}`} className="btn-outline btn-sm mt-2">تعديل</Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
