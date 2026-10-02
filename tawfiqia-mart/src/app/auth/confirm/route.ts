import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Handles Supabase email confirmation and password recovery links via
 * token_hash exchange. Auth flows always pass through the server.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // User-supplied targets must stay same-origin (open-redirect defense).
  const next = safeNextPath(searchParams.get("next"));

  if (token_hash && type) {
    const sb = await createClient();
    const { error } = await sb.auth.verifyOtp({
      token_hash,
      type: type as "email" | "recovery" | "invite",
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${type === "recovery" ? "/reset-password" : next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
