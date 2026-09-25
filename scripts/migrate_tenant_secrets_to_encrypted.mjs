// scripts/migrate_tenant_secrets_to_encrypted.mjs
// ============================================================================
// One-shot script para migrar credenciales SISPRO existentes en tenant_secrets
// desde formato plaintext hacia envelopes cifrados AES-256-GCM.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { webcrypto } from "node:crypto";

const crypto = globalThis.crypto || webcrypto;

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ACTIVE_KEY_ID = process.env.TENANT_SECRETS_ACTIVE_KEY_ID || "v1";

const base64ToUint8 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const uint8ToBase64 = (bytes) => btoa(String.fromCharCode(...bytes));

async function getMasterKey() {
  const envVarName = ACTIVE_KEY_ID === "v1" ? "TENANT_SECRETS_MASTER_KEY_V1" : `TENANT_SECRETS_MASTER_KEY_${ACTIVE_KEY_ID.toUpperCase()}`;
  const rawB64 = process.env[envVarName] || process.env.TENANT_SECRETS_MASTER_KEY;
  if (!rawB64) {
    throw new Error(`[FAIL-CLOSED] Clave maestra de cifrado no disponible en variable ${envVarName}.`);
  }
  const keyBytes = base64ToUint8(rawB64.trim());
  if (keyBytes.length !== 32) {
    throw new Error("[FAIL-CLOSED] Longitud de clave maestra invalida (debe ser 32 bytes).");
  }
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptSecret(plaintext, aadString) {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const aad = new TextEncoder().encode(aadString);

  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    data
  );

  return {
    v: 1,
    alg: "A256GCM",
    kid: ACTIVE_KEY_ID,
    iv: uint8ToBase64(iv),
    ciphertext: uint8ToBase64(new Uint8Array(encryptedBuf)),
  };
}

async function decryptSecret(envelope, aadString) {
  const key = await getMasterKey();
  const iv = base64ToUint8(envelope.iv);
  const ciphertext = base64ToUint8(envelope.ciphertext);
  const aad = new TextEncoder().encode(aadString);

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decryptedBuf);
}

export async function migrateTenantSecretsToEncrypted(options = {}) {
  const isDryRun = Boolean(options.dryRun || process.argv.includes("--dry-run"));
  const confirmRemote = Boolean(options.confirmRemoteExecution || process.argv.includes("--confirm-remote-execution"));
  console.log(`[MIGRATION-ENCRYPTION] Iniciando cifrado de secretos en tenant_secrets (dryRun=${isDryRun})...`);

  const urlObj = new URL(SUPABASE_URL);
  const isLocalHost = ["127.0.0.1", "localhost"].includes(urlObj.hostname);
  if (!isLocalHost && !confirmRemote) {
    throw new Error(
      `[SEGURIDAD FAIL-CLOSED] Destino no local detectado: ${urlObj.hostname}. ` +
      `Para ejecutar (incluso dry-run) contra un host remoto se requiere el flag explicito --confirm-remote-execution.`
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: rows, error: readErr } = await supabase
    .from("tenant_secrets")
    .select("tenant_id, sispro_config");

  if (readErr) throw readErr;

  let totalInstitutionsEncrypted = 0;
  let totalDoctorsEncrypted = 0;
  let totalTenantsProcessed = 0;

  for (const row of rows || []) {
    const tenantId = row.tenant_id;
    const current = row.sispro_config || {};
    let needsUpdate = false;
    let nextSispro = { ...current };

    // 1. Cifrar institucional si es plaintext
    if (typeof current.sisproPassword === "string" && current.sisproPassword.trim().length > 0) {
      const plaintext = current.sisproPassword.trim();
      const aad = `${tenantId}|sispro|institutional|v1`;
      const env = await encryptSecret(plaintext, aad);

      // Verificación de descifrado previo a eliminación
      const decrypted = await decryptSecret(env, aad);
      if (decrypted !== plaintext) {
        throw new Error(`[VERIFICACION FALLIDA] Descifrado de prueba fallo para tenant ${tenantId}.`);
      }

      nextSispro.sisproPasswordEncrypted = env;
      delete nextSispro.sisproPassword;
      needsUpdate = true;
      totalInstitutionsEncrypted++;
    }

    // 2. Cifrar doctores si son plaintext
    if (current.doctores && typeof current.doctores === "object") {
      const updatedDoctores = { ...current.doctores };
      for (const [doctorId, docData] of Object.entries(current.doctores)) {
        if (docData && typeof docData.sisproPassword === "string" && docData.sisproPassword.trim().length > 0) {
          const plaintext = docData.sisproPassword.trim();
          const aad = `${tenantId}|sispro|doctor|${doctorId}|v1`;
          const env = await encryptSecret(plaintext, aad);

          const decrypted = await decryptSecret(env, aad);
          if (decrypted !== plaintext) {
            throw new Error(`[VERIFICACION FALLIDA] Descifrado de prueba fallo para doctor ${doctorId}.`);
          }

          updatedDoctores[doctorId] = {
            ...docData,
            sisproPasswordEncrypted: env,
            configured: true,
            migratedAt: new Date().toISOString()
          };
          delete updatedDoctores[doctorId].sisproPassword;
          needsUpdate = true;
          totalDoctorsEncrypted++;
        }
      }
      nextSispro.doctores = updatedDoctores;
    }

    if (!needsUpdate) continue;

    if (isDryRun) {
      console.log(`[DRY-RUN] Tenant ${tenantId}: detectados secretos plaintext para cifrar.`);
      totalTenantsProcessed++;
      continue;
    }

    // Guardar en tenant_secrets
    const { error: saveErr } = await supabase
      .from("tenant_secrets")
      .update({
        sispro_config: nextSispro,
        updated_at: new Date().toISOString()
      })
      .eq("tenant_id", tenantId);

    if (saveErr) throw saveErr;

    // Verificación post-guardado
    const { data: verifyRow, error: vErr } = await supabase
      .from("tenant_secrets")
      .select("sispro_config")
      .eq("tenant_id", tenantId)
      .single();

    if (vErr || !verifyRow) throw new Error("Fallo al verificar post-guardado.");

    totalTenantsProcessed++;
    console.log(`[TENANT] Clínica ${tenantId}: secretos migrados a envelope cifrado.`);
  }

  console.log(`[MIGRATION-ENCRYPTION FIN] Clínicas: ${totalTenantsProcessed} | Institucionales cifrados: ${totalInstitutionsEncrypted} | Doctores cifrados: ${totalDoctorsEncrypted}`);
  return {
    totalTenantsProcessed,
    totalInstitutionsEncrypted,
    totalDoctorsEncrypted
  };
}

if (process.argv[1]?.endsWith("migrate_tenant_secrets_to_encrypted.mjs")) {
  migrateTenantSecretsToEncrypted().catch(err => {
    console.error("[ERROR EN MIGRACION CIFRADO]", err);
    process.exit(1);
  });
}
