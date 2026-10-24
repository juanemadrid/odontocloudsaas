import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { transformWithOxc } from 'vite';
import { createHelpSettingsHandler, HELP_KEY_AAD } from '../supabase/functions/odontocloud-help-settings/handler.mjs';
import { authenticateHelpSettings } from '../supabase/functions/odontocloud-help-settings/auth.mjs';
import { resolveStoredHelpConfig } from '../supabase/functions/odontocloud-help/credentialStore.mjs';
import { createHelpHandler } from '../supabase/functions/odontocloud-help/handler.mjs';
import { createHelpCrypto, HELP_MASTER_FILE } from '../supabase/functions/_shared/helpCrypto.mjs';

// Compile the actual shared crypto module, preserving compatibility with Node 20 CI.
const cryptoSource = await transformWithOxc(readFileSync('supabase/functions/tenant-secrets/crypto.ts', 'utf8'), 'crypto.ts');
const { encryptSecret, decryptSecret, loadEncryptionKey } = await import('data:text/javascript;base64,' + Buffer.from(cryptoSource.code).toString('base64'));

const oldMaster = process.env.TENANT_SECRETS_MASTER_KEY_V1;
const oldKeyId = process.env.TENANT_SECRETS_ACTIVE_KEY_ID;
process.env.TENANT_SECRETS_MASTER_KEY_V1 = randomBytes(32).toString('base64');
process.env.TENANT_SECRETS_ACTIVE_KEY_ID = 'v1';
const apiKey = 'unit_test_help_key_' + 'A'.repeat(24);
let stored = null, providerCalls = 0, writes = 0, reads = 0;
const env = () => undefined;
function makeHandler(overrides = {}) {
  return createHelpSettingsHandler({
    authenticate: async token => token === 'valid' ? { userId: 'admin-user', superadmin: true } : null,
    readCredential: async () => { reads++; return stored; },
    writeCredential: async row => { writes++; stored = row; },
    encrypt: encryptSecret, canEncrypt: loadEncryptionKey, reserveCheck: async () => true, env,
    fetchImpl: async (_url, options) => {
      providerCalls++;
      const body = JSON.parse(options.body);
      assert.equal(options.headers['x-goog-api-key'], apiKey);
      assert.equal(options.redirect, 'error');
      assert.equal(body.generationConfig.maxOutputTokens, 8);
      assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
      assert.equal(body.contents[0].parts[0].text, 'Responde OK.');
      assert.ok(!body.tools);
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'OK' }] } }] });
    }, ...overrides,
  });
}
const request = (body = { action: 'status' }, token = 'valid') => new Request('https://test.invalid/settings', {
  method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
});
const result = async (handler, body, token) => {
  const response = await handler(request(body, token));
  return { status: response.status, body: await response.json() };
};
try {
  for (const [profile, expected] of [[{ role: 'superadmin', activo: true }, true], [{ role: 'admin', activo: true }, false],
    [{ role: 'superadmin', activo: false }, false], [null, false]]) {
    const fakeAdmin = { auth: { getUser: async () => ({ data: { user: { id: 'verified-id', user_metadata: { role: 'superadmin' } } }, error: null }) },
      from: table => { assert.equal(table, 'profiles'); return { select: () => ({ eq: (column, value) => {
        assert.equal(column, 'id'); assert.equal(value, 'verified-id');
        return { maybeSingle: async () => ({ data: profile, error: null }) };
      } }) }; } };
    assert.equal((await authenticateHelpSettings(fakeAdmin, 'token')).superadmin, expected);
  }
  const handler = makeHandler();
  assert.equal((await result(handler, undefined, null)).status, 401);
  assert.equal((await result(handler, undefined, 'invalid')).status, 403);
  assert.equal((await result(makeHandler({ authenticate: async () => ({ userId: 'clinic-user', superadmin: false }) }), { action: 'save', apiKey })).status, 403);
  assert.equal(reads, 0); assert.equal(writes, 0); assert.equal(providerCalls, 0);
  const empty = await result(handler);
  assert.equal(empty.body.configured, false); assert.equal(empty.body.encryptionReady, true);
  for (const body of [{ action: 'save', apiKey: 'short' }, { action: 'save', apiKey, tenantId: 'other' },
    { action: 'save', apiKey, model: 'unapproved' }, { action: 'status', apiKey }, { action: 'delete' }]) {
    assert.equal((await result(handler, body)).status, 400);
  }
  assert.equal((await result(handler, { action: 'save', apiKey: 'a'.repeat(3000) })).status, 413);
  assert.equal((await result(handler, { action: 'test', apiKey })).body.success, true);
  assert.equal(providerCalls, 1); assert.equal(writes, 0);
  assert.equal((await result(handler, { action: 'save', apiKey })).body.success, true);
  assert.equal(providerCalls, 2); assert.equal(writes, 1);
  assert.equal(await decryptSecret(stored.encrypted_key, HELP_KEY_AAD), apiKey);
  assert.ok(!JSON.stringify(stored).includes(apiKey));
  await assert.rejects(() => decryptSecret(stored.encrypted_key, 'another-app'));
  const status = await result(handler);
  assert.equal(status.body.source, 'panel');
  assert.equal(status.body.configured, true);
  assert.ok(!JSON.stringify(status.body).includes(apiKey));
  assert.ok(!JSON.stringify(status.body).includes('ciphertext'));
  const original = JSON.stringify(stored);
  const beforeWrites = writes;
  for (const overrides of [
    { fetchImpl: async () => new Response('', { status: 403 }) },
    { fetchImpl: async () => new Response('', { status: 429 }) },
    { fetchImpl: async () => new Response('', { status: 404 }) },
    { fetchImpl: async () => new Response('', { status: 500 }) },
    { fetchImpl: async () => Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] }) },
    { fetchImpl: async () => { throw new Error('sensitive-provider-error-' + apiKey); } },
    { reserveCheck: async () => false },
    { canEncrypt: async () => { throw new Error('No master key'); } },
    { encrypt: async () => { throw new Error('Encryption failed'); } },
  ]) {
    const failed = await result(makeHandler(overrides), { action: 'save', apiKey });
    assert.ok(failed.status >= 400); assert.equal(failed.body.success, false);
    assert.ok(!JSON.stringify(failed.body).includes(apiKey));
    assert.equal(JSON.stringify(stored), original);
  }
  assert.equal(writes, beforeWrites);
  assert.equal((await result(makeHandler({ writeCredential: async () => { throw new Error('storage failure'); } }), { action: 'save', apiKey })).status, 503);
  assert.equal(JSON.stringify(stored), original);
  const timedOut = await result(makeHandler({ timeoutMs: 10, fetchImpl: async (_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
  }) }), { action: 'save', apiKey });
  assert.equal(timedOut.status, 503); assert.equal(JSON.stringify(stored), original);
  const runtime = await resolveStoredHelpConfig({ readCredential: async () => stored, decrypt: decryptSecret, env });
  assert.equal(runtime.ODONTO_HELP_GEMINI_API_KEY, apiKey);
  assert.equal(runtime.ODONTO_HELP_ENABLED, 'true');
  const stopped = await resolveStoredHelpConfig({ readCredential: async () => stored, decrypt: decryptSecret, env: k => k === 'ODONTO_HELP_ENABLED' ? 'false' : undefined });
  assert.equal(stopped.ODONTO_HELP_ENABLED, 'false');
  await assert.rejects(() => resolveStoredHelpConfig({ readCredential: async () => stored, decrypt: async () => { throw new Error('tampered'); }, env }));
  assert.deepEqual(await resolveStoredHelpConfig({ readCredential: async () => null, decrypt: decryptSecret, env }), {});

  // A real encrypted save is immediately consumed by the help handler without env changes.
  let usedKey;
  const help = createHelpHandler({ env, authenticate: async () => ({ userId: 'user', tenantId: 'clinic', active: true }),
    resolveConfig: () => resolveStoredHelpConfig({ readCredential: async () => stored, decrypt: decryptSecret, env }),
    reserve: async () => ({ allowed: true }), fetchImpl: async (_url, options) => {
      usedKey = options.headers['x-goog-api-key'];
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Abre [Administración] y selecciona [RIPS JSON].' }] } }] });
    } });
  const helpResponse = await help(request({ question: 'Dónde está el botón RIPS' }));
  assert.equal((await helpResponse.json()).provider, 'gemini'); assert.equal(usedKey, apiKey);
  const dedicatedMaster = randomBytes(32).toString('base64');
  const helpCrypto = createHelpCrypto({ env, readPrivateFile: async path => {
    assert.equal(path, HELP_MASTER_FILE); return dedicatedMaster;
  }, legacyEncrypt: encryptSecret, legacyDecrypt: decryptSecret, legacyCanEncrypt: loadEncryptionKey });
  // Old credentials still decrypt with the original key; new ones use a separate key.
  assert.equal(await helpCrypto.decrypt(stored.encrypted_key, HELP_KEY_AAD), apiKey);
  await helpCrypto.canEncrypt();
  const dedicated = await helpCrypto.encrypt(apiKey, HELP_KEY_AAD);
  assert.equal(dedicated.kid, 'help-v1');
  assert.equal(await helpCrypto.decrypt(dedicated, HELP_KEY_AAD), apiKey);
  assert.notEqual((await helpCrypto.encrypt(apiKey, HELP_KEY_AAD)).iv, dedicated.iv);
  await assert.rejects(() => helpCrypto.decrypt(dedicated, 'another-system'));
  await assert.rejects(() => helpCrypto.decrypt({ ...dedicated, ciphertext: dedicated.ciphertext.slice(0, -8) }, HELP_KEY_AAD));
  const missingFile = async () => { const e = new Error(); e.code = 'ENOENT'; throw e; };
  const missingCrypto = createHelpCrypto({ env, readPrivateFile: missingFile,
    legacyEncrypt: encryptSecret, legacyDecrypt: decryptSecret, legacyCanEncrypt: loadEncryptionKey });
  await assert.rejects(() => missingCrypto.decrypt(dedicated, HELP_KEY_AAD));
  const deniedCrypto = createHelpCrypto({ env, readPrivateFile: async () => { throw new Error('EACCES'); },
    legacyCanEncrypt: async () => { throw new Error('Must not fall back'); } });
  await assert.rejects(() => deniedCrypto.canEncrypt(), /unavailable/);
  const invalidCrypto = createHelpCrypto({ env: () => 'invalid-key', readPrivateFile: missingFile });
  await assert.rejects(() => invalidCrypto.canEncrypt(), /Invalid help encryption/);
  const dedicatedHandler = makeHandler({ encrypt: helpCrypto.encrypt, canEncrypt: helpCrypto.canEncrypt });
  assert.equal((await result(dedicatedHandler, { action: 'save', apiKey })).body.success, true);
  const dedicatedConfig = await resolveStoredHelpConfig({ readCredential: async () => stored, decrypt: helpCrypto.decrypt, env });
  assert.equal(dedicatedConfig.ODONTO_HELP_GEMINI_API_KEY, apiKey);
  console.log('Help settings: superadmin-only access, AES-GCM/AAD, minimal connection test, safe replacement, masked status, quotas, timeout, and immediate help integration verified.');
  console.log('Dedicated help key: private file provisioning contract, legacy compatibility, random IVs, tamper detection and missing/corrupt key fail-closed verified.');
} finally {
  if (oldMaster === undefined) delete process.env.TENANT_SECRETS_MASTER_KEY_V1; else process.env.TENANT_SECRETS_MASTER_KEY_V1 = oldMaster;
  if (oldKeyId === undefined) delete process.env.TENANT_SECRETS_ACTIVE_KEY_ID; else process.env.TENANT_SECRETS_ACTIVE_KEY_ID = oldKeyId;
}
