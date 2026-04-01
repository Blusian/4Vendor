import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/utils/supabase/database.types";
import { getSupabaseConfig } from "@/utils/supabase/security";

export async function createClient() {
  const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always persist cookies directly.
          // The root proxy refresh flow handles auth cookie updates.
        }
      },
    },
  });
}
