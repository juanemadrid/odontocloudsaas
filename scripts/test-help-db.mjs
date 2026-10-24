// Optional local PostgreSQL/WASM verification. Never connects to a remote database.
// Install @electric-sql/pglite@0.5.11 in a temporary directory and pass its package path.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');
const db = new PGlite();
const clinicA = '10000000-0000-0000-0000-000000000001';
const clinicB = '10000000-0000-0000-0000-000000000002';
const userA = '20000000-0000-0000-0000-000000000001';
const userB = '20000000-0000-0000-0000-000000000002';
const admin = '20000000-0000-0000-0000-000000000003';
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE public.tenants (id uuid PRIMARY KEY, activo boolean);
    CREATE TABLE public.profiles (id uuid PRIMARY KEY, tenant_id uuid, activo boolean, role text);
    CREATE FUNCTION public.is_superadmin() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
      SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND activo IS TRUE AND role = 'superadmin') $$;
    GRANT SELECT ON public.profiles, public.tenants TO service_role;
    INSERT INTO public.tenants VALUES ('${clinicA}',true),('${clinicB}',true);
    INSERT INTO public.profiles VALUES ('${userA}','${clinicA}',true,'admin'),('${userB}','${clinicB}',true,'admin'),('${admin}',null,true,'superadmin');`);
  await db.exec(readFileSync('supabase/migrations/20261024142001_odontocloud_help_controls.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261024145608_odontocloud_help_credentials.sql', 'utf8'));
  const reserve = async (u = userA, t = clinicA) => (await db.query('select public.reserve_odonto_help_request($1,$2) as result', [u,t])).rows[0].result;
  await db.exec('SET ROLE service_role');
  assert.equal((await reserve()).reason, 'disabled');
  await db.exec('RESET ROLE');
  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${admin}';
    UPDATE public.odonto_help_global SET enabled = true;
    INSERT INTO public.odonto_help_clinics(tenant_id,enabled,daily_limit,monthly_limit) VALUES ('${clinicA}',true,2,3),('${clinicB}',false,2,3); RESET ROLE;`);

  // A normal clinic admin cannot read configuration or change its own / other switch.
  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${userA}'`);
  assert.equal((await db.query('SELECT * FROM public.odonto_help_clinics')).rows.length, 0);
  assert.equal((await db.query('UPDATE public.odonto_help_clinics SET enabled = true RETURNING *')).rows.length, 0);
  await assert.rejects(() => db.exec(`INSERT INTO public.odonto_help_clinics(tenant_id,enabled) VALUES ('30000000-0000-0000-0000-000000000001',true)`));
  await assert.rejects(() => reserve());
  await db.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(() => db.exec('SELECT * FROM public.odonto_help_global'));
  await assert.rejects(() => reserve());
  await db.exec('RESET ROLE; SET ROLE service_role');
  assert.equal((await reserve(userA,clinicB)).reason, 'disabled');
  assert.equal((await reserve()).allowed, true);
  assert.equal((await reserve()).reason, 'quota'); // cooldown
  await db.exec("DELETE FROM public.odonto_help_usage WHERE period = 'cooldown'");
  assert.equal((await reserve()).allowed, true);
  await db.exec("DELETE FROM public.odonto_help_usage WHERE period = 'cooldown'");
  assert.equal((await reserve()).reason, 'quota'); // clinic daily limit
  await db.exec(`UPDATE public.odonto_help_clinics SET enabled = true WHERE tenant_id = '${clinicB}'`);
  assert.equal((await reserve(userA,clinicB)).reason, 'disabled'); // authoritative membership
  assert.equal((await reserve(userB,clinicB)).allowed, true); // isolation
  await db.exec('UPDATE public.odonto_help_global SET enabled = false');
  assert.equal((await reserve(userB,clinicB)).reason, 'disabled');
  await db.exec('UPDATE public.odonto_help_global SET enabled = true; DELETE FROM public.odonto_help_usage');
  await db.exec(`UPDATE public.odonto_help_clinics SET enabled = false WHERE tenant_id = '${clinicA}'`);
  assert.equal((await reserve()).reason, 'disabled');
  await db.exec(`UPDATE public.odonto_help_clinics SET enabled = true WHERE tenant_id = '${clinicA}';
    UPDATE public.odonto_help_global SET monthly_limit = 1;`);
  assert.equal((await reserve()).allowed, true);
  assert.equal((await reserve(userB,clinicB)).reason, 'quota'); // global monthly cap
  await db.exec(`RESET ROLE; UPDATE public.profiles SET activo = false WHERE id = '${userA}';
    DELETE FROM public.odonto_help_usage; SET ROLE service_role;`);
  assert.equal((await reserve()).reason, 'disabled');
  await db.exec(`RESET ROLE; UPDATE public.profiles SET activo = true WHERE id = '${userA}';
    UPDATE public.odonto_help_global SET monthly_limit = 500, daily_limit = 40;
    UPDATE public.odonto_help_clinics SET daily_limit = 1, monthly_limit = 3 WHERE tenant_id = '${clinicA}';
    DELETE FROM public.odonto_help_usage; SET ROLE service_role;`);
  const simultaneous = await Promise.all([reserve(), reserve()]);
  assert.equal(simultaneous.filter(r => r.allowed).length, 1);
  await db.exec(`DELETE FROM public.odonto_help_usage;
    UPDATE public.odonto_help_clinics SET daily_limit = 15, monthly_limit = 1 WHERE tenant_id = '${clinicA}';`);
  assert.equal((await reserve()).allowed, true);
  await db.exec("DELETE FROM public.odonto_help_usage WHERE period = 'cooldown' OR length(period) > 7");
  assert.equal((await reserve()).reason, 'quota');
  await db.exec(`DELETE FROM public.odonto_help_usage; UPDATE public.odonto_help_global SET daily_limit = 1`);
  assert.equal((await reserve()).allowed, true);
  assert.equal((await reserve(userB,clinicB)).reason, 'quota');
  await db.exec(`DELETE FROM public.odonto_help_usage; UPDATE public.odonto_help_global SET daily_limit = 40`);
  await db.exec(`INSERT INTO public.odonto_help_usage VALUES ('global',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI'),4)`);
  assert.equal((await reserve()).reason, 'quota');
  await db.exec(`RESET ROLE; SET ROLE authenticated; SET request.jwt.claim.sub = '${admin}'`);
  // Even the superadmin browser cannot retrieve encrypted credentials via REST.
  await assert.rejects(() => db.exec('SELECT * FROM public.odonto_help_credentials'));
  await assert.rejects(() => db.exec('UPDATE public.odonto_help_credentials SET model = model'));
  await assert.rejects(() => db.query('SELECT public.reserve_odonto_help_key_check($1)', [admin]));
  await db.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(() => db.exec('SELECT * FROM public.odonto_help_credentials'));
  await db.exec('RESET ROLE; SET ROLE service_role');
  const check = async u => (await db.query('SELECT public.reserve_odonto_help_key_check($1) AS allowed', [u])).rows[0].allowed;
  assert.equal(await check(userA), false);
  for (let i = 0; i < 6; i++) assert.equal(await check(admin), true);
  assert.equal(await check(admin), false);
  await db.exec("UPDATE public.odonto_help_key_checks SET minute_start = now() - interval '2 minutes', day_count = 30");
  assert.equal(await check(admin), false);
  await db.exec("UPDATE public.odonto_help_key_checks SET day = day - 1");
  assert.equal(await check(admin), true);
  await db.query(`INSERT INTO public.odonto_help_credentials(encrypted_key,updated_by) VALUES ($1,$2)`, [
    { v: 1, alg: 'A256GCM', kid: 'v1', iv: 'test-iv', ciphertext: 'test-ciphertext' }, admin,
  ]);
  await assert.rejects(() => db.query(`UPDATE public.odonto_help_credentials SET encrypted_key = $1`, [{}]));
  console.log('PostgreSQL help: both migrations, RLS, credential isolation, service-only reservations, switches, membership, concurrent attempts and all quotas verified.');
} finally { await db.close(); }
