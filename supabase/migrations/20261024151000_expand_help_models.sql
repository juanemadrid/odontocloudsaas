-- Allow modern and standard Gemini models in odonto_help_credentials
BEGIN;
ALTER TABLE public.odonto_help_credentials DROP CONSTRAINT IF EXISTS odonto_help_credentials_model_check;
ALTER TABLE public.odonto_help_credentials ADD CONSTRAINT odonto_help_credentials_model_check 
  CHECK (model IN ('gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'));
ALTER TABLE public.odonto_help_credentials ALTER COLUMN model SET DEFAULT 'gemini-3.8-flash';
NOTIFY pgrst, 'reload schema';
COMMIT;
