import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { getSafeInternalRedirectPath, isSupabaseConfigured } from "@/utils/supabase/security";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = getSafeInternalRedirectPath(searchParams.get("next"));
  const loginRedirect = request.nextUrl.clone();
  loginRedirect.pathname = "/login";

  if (!isSupabaseConfigured()) {
    loginRedirect.searchParams.set("auth", "backend_unavailable");
    const unavailableResponse = NextResponse.redirect(loginRedirect, 303);
    unavailableResponse.headers.set("Cache-Control", "no-store");
    return unavailableResponse;
  }

  const redirectTo = new URL(next, request.url);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      const successResponse = NextResponse.redirect(redirectTo, 303);
      successResponse.headers.set("Cache-Control", "no-store");
      return successResponse;
    }
  }

  loginRedirect.searchParams.set("auth", "confirm_failed");
  const failureResponse = NextResponse.redirect(loginRedirect, 303);
  failureResponse.headers.set("Cache-Control", "no-store");
  return failureResponse;
}
