import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/utils/supabase/database.types";
import { getSupabaseBrowserConfig } from "@/utils/supabase/security";

const { url: supabaseUrl, key: supabaseKey } = getSupabaseBrowserConfig();

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
