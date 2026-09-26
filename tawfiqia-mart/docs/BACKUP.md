# النسخ الاحتياطي والاسترجاع — EL TAWFIKIA MART

الطلبات والبيانات المالية سجل ثابت (immutable)، لذا النسخ الاحتياطي المنتظم ضروري.

## ما الذي يجب نسخه

| العنصر | أين | حساسية |
|---|---|---|
| جداول Postgres (منتجات، طلبات، مدفوعات، عملاء، مخزون، سجل التدقيق) | Supabase Postgres | الأهم |
| صور المنتجات والبانرات | Bucket `products` (عام) | مهم |
| إيصالات التحويل والملفات الخاصة | Bucket `private` | حساس |

## النسخ اليدوي السريع

من **Supabase Dashboard → Database → Backups** تُتاح نسخ تلقائية على الخطط
المدفوعة. على الخطة المجانية استخدم `pg_dump` دوريًا:

```bash
# رابط الاتصال من Dashboard → Database → Connection string
export DB_URL="postgresql://postgres:[PASSWORD]@db.<REF>.supabase.co:5432/postgres"

# نسخة كاملة مضغوطة
pg_dump "$DB_URL" --no-owner --no-privileges -F c -f "tawfiqia-$(date +%F).dump"

# أو نص SQL عادي
pg_dump "$DB_URL" --no-owner --no-privileges | gzip > "tawfiqia-$(date +%F).sql.gz"
```

ملاحظة: Supabase قد يتطلب اتصال IPv6 أو استخدام Session Pooler (port 5432/6543
مع بيانات Pooler من لوحة الاتصال).

## نسخ Storage

```bash
# يتطلب supabase CLI ومفتاح service_role
supabase --project-ref <PROJECT_REF> storage cp "ss:///products" "./backup/products" --recursive
supabase --project-ref <PROJECT_REF> storage cp "ss:///private"  "./backup/private" --recursive
```

## نسخة مجدولة بدون تكلفة (GitHub Actions + S3-compatible مجاني)

مثال أسبوعي يرفع نسخة إلى أي خدمة S3 مجانية (Backblaze B2 / Cloudflare R2).
خزّن الأسرار في GitHub Secrets ولا تضعها في المستودع:

```yaml
# .github/workflows/backup.yml
name: Database backup
on:
  schedule:
    - cron: "0 2 * * 1"   # اثنين أسبوعيًا 02:00 UTC
  workflow_dispatch:
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Dump and upload
        env:
          DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          sudo apt-get update -qq && sudo apt-get install -y -qq postgresql-client
          pg_dump "$DB_URL" --no-owner --no-privileges | gzip > backup.sql.gz
          # استبدل هذا بسطر rclone/aws حسب مزود التخزين
          echo "backup size: $(du -h backup.sql.gz | cut -f1)"
```

> ملاحظة خصوصية: ملف النسخة يحتوي بيانات العملاء وإيصالات الدفع — خزّنه مشفّرًا
> وفي مكان وصوله محدود، ولا ترفعه لمستودع عام.

## الاسترجاع

```bash
# إلى قاعدة فاضية جديدة (مشروع Supabase جديد):
pg_restore --no-owner --no-privileges -d "$NEW_DB_URL" -j 2 -v "tawfiqia-2026-01-01.dump"

# أو:
gunzip -c tawfiqia-2026-01-01.sql.gz | psql "$NEW_DB_URL"
```

بعد الاسترجاع:

1. أعد تطبيق أدوار Storage والسياسات إن أنشأت المشروع من الصفر (الترحيلات 0001→0015).
2. حدّث متغيرات البيئة في Vercel بالمفاتيح الجديدة إن تغيّر المشروع.
3. أعد رفع محتويات `products/` و`private/` إلى Buckets المشروع الجديد.
4. اختبر تسجيل الدخول، إنشاء طلب، وفحص إيصال خاص بلينك موقّع.

## سياسة الاحتفاظ المقترحة

- نسخة يومية محفوظة 7 أيام.
- نسخة أسبوعية محفوظة 4 أسابيع.
- نسخة شهرية محفوظة 6 أشهر (تُضبط وفقًا للالتزامات القانونية).

## قبل الترقيات

اعمل نسخة قبل أي تعديل على الترحيلات أو وظائف التسعير:

```bash
pg_dump "$DB_URL" --no-owner --no-privileges -F c -f "pre-upgrade-$(date +%F-%H%M).dump"
```

الترحيلات مصممة لتُضاف (additive)؛ تعديل وظائف التسعير أو حالات الطلب يجب أن يراجعه
مسؤول لأن الطلبات التاريخية تعتمد على لقطات ثابتة (`pricing_snapshot`/`address_snapshot`).
