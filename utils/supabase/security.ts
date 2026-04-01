const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_FALLBACK_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY";

export type SupabaseConfig = {
  key: string;
  url: string;
};

export type SupabaseConfigStatus = {
  configured: boolean;
  error: string | null;
  missing: string[];
};

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`[security] Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizeSupabaseUrl(rawUrl: string) {
  const parsed = new URL(rawUrl);

  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`[security] ${SUPABASE_URL_ENV} must be an origin-only URL.`);
  }

  return parsed.origin;
}

function readConfiguredPublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ??
    ""
  );
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missing: string[] = [];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = readConfiguredPublishableKey();

  if (!url) {
    missing.push(SUPABASE_URL_ENV);
  }

  if (!key) {
    missing.push(`${SUPABASE_KEY_ENV} or ${SUPABASE_FALLBACK_KEY_ENV}`);
  }

  try {
    if (url) {
      normalizeSupabaseUrl(url);
    }
  } catch (error) {
    return {
      configured: false,
      error: error instanceof Error ? error.message : "[security] Supabase configuration is invalid.",
      missing,
    };
  }

  if (missing.length) {
    return {
      configured: false,
      error: `[security] Missing required environment variable: ${missing.join(", ")}`,
      missing,
    };
  }

  return {
    configured: true,
    error: null,
    missing,
  };
}

export function isSupabaseConfigured() {
  return getSupabaseConfigStatus().configured;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = normalizeSupabaseUrl(readRequiredEnv(SUPABASE_URL_ENV));
  const key = readConfiguredPublishableKey();

  if (!key) {
    throw new Error(
      `[security] Missing required environment variable: ${SUPABASE_KEY_ENV} or ${SUPABASE_FALLBACK_KEY_ENV}`,
    );
  }

  return { key, url };
}

export function getSupabaseBrowserConfig(): SupabaseConfig {
  const urlValue = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const url = urlValue ? normalizeSupabaseUrl(urlValue) : "";
  const key = readConfiguredPublishableKey();

  if (!url) {
    throw new Error(
      `[security] Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL`,
    );
  }

  if (!key) {
    throw new Error(
      `[security] Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`,
    );
  }

  return { key, url };
}

export function getSafeInternalRedirectPath(
  input: string | null,
  fallback = "/dashboard",
) {
  if (!input) {
    return fallback;
  }

  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\") || /[\u0000-\u001F\u007F]/.test(input)) {
    return fallback;
  }

  return input;
}
