import { createClient } from "@supabase/supabase-js";

const requireValue = (value, name) => {
  if (!value) {
    throw new Error("Falta la variable de entorno " + name);
  }
  return value;
};

export const createSupabaseAdminClient = (options = {}) => {
  const url = requireValue(
    process.env.TARGET_SUPABASE_URL || process.env.SUPABASE_URL,
    "TARGET_SUPABASE_URL",
  );
  const serviceKey = requireValue(
    process.env.TARGET_SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY,
    "TARGET_SUPABASE_SERVICE_KEY",
  );

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...options,
  });
};
