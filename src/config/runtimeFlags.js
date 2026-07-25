const readBooleanEnv = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

export const DEV_BYPASS_ENABLED =
  import.meta.env.DEV && readBooleanEnv(import.meta.env.VITE_ENABLE_DEV_BYPASS, true);

export const OFFLINE_SESSION_ENABLED =
  import.meta.env.DEV || readBooleanEnv(import.meta.env.VITE_ENABLE_OFFLINE_SESSION, false);

export const DIAN_MOCK_ENABLED =
  import.meta.env.DEV && readBooleanEnv(import.meta.env.VITE_ENABLE_DIAN_MOCK, true);
