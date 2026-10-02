import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { arabicError } from "@/lib/server/errors";
import { uploadReceipt } from "@/lib/server/upload";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    // Section 11/39: receipts land in the private bucket and can accumulate as
    // orphans, so they get a tighter bucket than generic image uploads.
    await enforceRateLimit("receiptUpload", user.id);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "FILE_INVALID" }, { status: 400 });
    }
    const path = await uploadReceipt(file, user.id);
    return NextResponse.json({ path });
  } catch (err) {
    const status = String((err as Error)?.message) === "AUTH_REQUIRED" ? 401 : 400;
    return NextResponse.json({ error: arabicError(err) }, { status });
  }
}
