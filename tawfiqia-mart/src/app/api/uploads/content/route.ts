import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/server/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { arabicError } from "@/lib/server/errors";
import { uploadContentImage } from "@/lib/server/upload";

export async function POST(request: NextRequest) {
  try {
    await requirePermission("content.write");
    await enforceRateLimit("upload");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "FILE_INVALID" }, { status: 400 });
    }
    const { url, path } = await uploadContentImage(file);
    return NextResponse.json({ url, path });
  } catch (err) {
    const status = String((err as Error)?.message) === "AUTH_REQUIRED" ? 401 : 400;
    return NextResponse.json({ error: arabicError(err) }, { status });
  }
}
