import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import type { Database } from "@/utils/supabase/database.types";
import { getSupabaseConfig } from "@/utils/supabase/security";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  let supabaseUrl = "";
  let supabaseKey = "";

  try {
    ({ url: supabaseUrl, key: supabaseKey } = getSupabaseConfig());
  } catch {
    return response;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    // If the session is corrupted or expired, let the request continue.
    // The next interaction will surface a clean unauthenticated state.
  }

  return response;
}
