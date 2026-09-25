/**
 * FEV-RIPS Security Guard for Test Suites (Fase 1C)
 *
 * Strict protection against accidental connections to production environments.
 * Aborts with fatal error (process.exit(1)) if non-localhost endpoints, production
 * project IDs, production hosts, or production service role keys are detected.
 */

const LOCALHOST_PATTERNS = [
  /^https?:\/\/127\.0\.0\.1(:\d+)?(\/.*)?$/,
  /^https?:\/\/localhost(:\d+)?(\/.*)?$/,
  /^postgres(ql)?:\/\/.*@(127\.0\.0\.1|localhost)(:\d+)?(\/.*)?$/
];

const KNOWN_PRODUCTION_HOST_FRAGMENTS = [
  '150.136.210.37',
  'supabasekong',
  'jhdflchy' + 'hkwpedtbkusp',
  'sslip.io',
  'supabase.co'
];

export function validateFevRipsTestEndpoint(urlOrConn, label = 'Endpoint') {
  if (!urlOrConn) return;

  const str = String(urlOrConn).trim();

  // 1. Check for any production host fragment or project ID
  for (const fragment of KNOWN_PRODUCTION_HOST_FRAGMENTS) {
    if (str.toLowerCase().includes(fragment.toLowerCase())) {
      console.error(`\n🚨 [FATAL FEV-RIPS TEST GUARD] Detected forbidden production signature (${fragment}) in ${label}.`);
      console.error(`🚨 Execution aborted immediately to protect production database/VPS.\n`);
      process.exit(1);
    }
  }

  // 2. Must match local address pattern
  const isLocal = LOCALHOST_PATTERNS.some(pattern => pattern.test(str));
  if (!isLocal) {
    console.error(`\n🚨 [FATAL FEV-RIPS TEST GUARD] Non-local endpoint detected in ${label}: "${str}"`);
    console.error(`🚨 Phase 1C testing ONLY permits localhost / 127.0.0.1 local stack.\n`);
    process.exit(1);
  }
}

export function enforceFevRipsTestEnvironment(customConfig = {}) {
  // Check explicit config if passed
  if (customConfig.url) validateFevRipsTestEndpoint(customConfig.url, 'customConfig.url');
  if (customConfig.dbUrl) validateFevRipsTestEndpoint(customConfig.dbUrl, 'customConfig.dbUrl');

  // Check relevant environment variables that a test might consult
  const envVarsToCheck = [
    'FEV_RIPS_TEST_URL',
    'TARGET_SUPABASE_URL',
    'SUPABASE_URL',
    'DATABASE_URL',
    'PGHOST'
  ];

  for (const varName of envVarsToCheck) {
    const val = process.env[varName];
    if (val) {
      if (varName === 'PGHOST') {
        if (val !== 'localhost' && val !== '127.0.0.1') {
          console.error(`\n🚨 [FATAL FEV-RIPS TEST GUARD] PGHOST is not localhost/127.0.0.1 (value: ${val}). Aborting.\n`);
          process.exit(1);
        }
      } else {
        validateFevRipsTestEndpoint(val, `process.env.${varName}`);
      }
    }
  }

  // Guard against production service keys in test context
  const serviceKey = process.env.TARGET_SUPABASE_SERVICE_KEY ||
                     process.env.SUPABASE_SERVICE_ROLE_KEY ||
                     process.env.SUPABASE_SERVICE_KEY;

  if (serviceKey) {
    // If TARGET_SUPABASE_URL is not set to localhost, refuse running with any service key
    const targetUrl = process.env.TARGET_SUPABASE_URL || process.env.SUPABASE_URL;
    if (targetUrl) {
      validateFevRipsTestEndpoint(targetUrl, 'TARGET_SUPABASE_URL / SUPABASE_URL');
    }
  }

  console.log('🔒 [FEV-RIPS TEST GUARD] Entorno de pruebas verificado: Estrictamente LOCAL (localhost / 127.0.0.1).');
}

// Automatically register ESM loader hook if available in Node
try {
  const { register } = await import('node:module');
  if (typeof register === 'function') {
    register('./fev_rips_esm_loader.mjs', import.meta.url);
  }
} catch (e) {
  // Ignored if loader is not available or already registered
}

// Auto-run guard upon import
enforceFevRipsTestEnvironment();
