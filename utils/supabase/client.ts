import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/utils/supabase/database.types";
import { getSupabaseBrowserConfig } from "@/utils/supabase/security";

export function createClient() {
  const { url: supabaseUrl, key: supabaseKey } = getSupabaseBrowserConfig();
  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
