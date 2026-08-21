-- Las contrasenas pertenecen exclusivamente a Supabase Auth.
-- Elimina copias legacy del JSON de usuarios sin modificar las cuentas Auth.

update public.website_config as wc
set config = jsonb_set(
  wc.config,
  '{usuarios}',
  coalesce(
    (
      select jsonb_agg(user_item - 'password' order by ordinality)
      from jsonb_array_elements(wc.config -> 'usuarios') with ordinality as users(user_item, ordinality)
    ),
    '[]'::jsonb
  ),
  true
),
updated_at = now()
where jsonb_typeof(wc.config -> 'usuarios') = 'array'
  and jsonb_path_exists(
    wc.config,
    '$.usuarios[*] ? (@.password != null)'
  );

