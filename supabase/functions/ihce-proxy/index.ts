import { createClient } from "npm:@supabase/supabase-js@2";
import {
  encryptSecret,
  decryptSecret,
  EncryptedEnvelope
} from "./crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeRole = (value: unknown) =>
  String(value || "").trim().toLowerCase();

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ success: false, error: "Método no permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new HttpError(500, "La función no tiene configuradas sus credenciales internas (SUPABASE_URL / SERVICE_ROLE_KEY).");
    }

    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Debes iniciar sesión para acceder a interoperabilidad IHCE.");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      throw new HttpError(401, "La sesión no es válida o expiró.");
    }

    const { data: caller, error: profileError } = await admin
      .from("profiles")
      .select("tenant_id, role, activo")
      .eq("id", authData.user.id)
      .single();
    if (profileError || !caller || caller.activo !== true) {
      throw new HttpError(403, "Tu perfil no está autorizado o está inactivo.");
    }

    const role = normalizeRole(caller.role);
    const isSuperadmin = role === "superadmin";
    if (!isSuperadmin && !["admin", "administrador"].includes(role)) {
      throw new HttpError(403, "Solo un administrador puede gestionar la interoperabilidad IHCE.");
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");
    const requestedTenant = String(body?.tenantId || caller.tenant_id || "");
    const tenantId = isSuperadmin ? requestedTenant : String(caller.tenant_id || "");
    if (!tenantId) throw new HttpError(400, "La clínica (tenantId) es obligatoria.");

    if (!isSuperadmin && tenantId !== String(caller.tenant_id)) {
      throw new HttpError(403, "Aislamiento estricto: No puedes gestionar credenciales de otra clínica.");
    }

    // Helper: Leer configuración existente desde la base de datos
    const readCurrentConfig = async () => {
      const { data, error } = await admin
        .from("ihce_configurations")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.warn("Aviso al leer ihce_configurations:", error.message);
      }
      return data || null;
    };

    // ------------------------------------------------------------------------
    // ACCIÓN 1: status / get_config
    // ------------------------------------------------------------------------
    if (action === "status" || action === "get_config") {
      const current = await readCurrentConfig();
      if (!current) {
        return json({
          success: true,
          configured: false,
          config: null,
        });
      }

      const hasSecret = Boolean(current.client_secret_encrypted);
      const hasApimKey = Boolean(current.apim_subscription_key_encrypted);

      return json({
        success: true,
        configured: Boolean(current.client_id && hasSecret),
        config: {
          id: current.id,
          tenant_id: current.tenant_id,
          codigo_habilitacion_reps: current.codigo_habilitacion_reps || "",
          codigo_sede_reps: current.codigo_sede_reps || "01",
          codigo_servicio_reps: current.codigo_servicio_reps || "334",
          nombre_prestador: current.nombre_prestador || "",
          nit: current.nit || "",
          ambiente: current.ambiente || "SANDBOX_MOCK",
          client_id: current.client_id || "",
          tenant_id_auth: current.tenant_id_auth || "",
          scope: current.scope || "https://sandbox.ihcecol.gov.co/.default",
          api_fhir_endpoint: current.api_fhir_endpoint || "https://sandbox.ihcecol.gov.co/ihce",
          token_endpoint: current.token_endpoint || null,
          has_secret: hasSecret,
          client_secret: hasSecret ? "••••••••••••••••" : "",
          has_apim_key: hasApimKey,
          apim_subscription_key: hasApimKey ? "••••••••••••••••" : "",
          is_active: current.is_active ?? false,
          auto_dispatch_enabled: current.auto_dispatch_enabled ?? true,
          ultimo_envio_at: current.ultimo_envio_at || null,
          ultimo_error_at: current.ultimo_error_at || null,
          ultimo_error_detalle: current.ultimo_error_detalle || null,
        },
      });
    }

    // ------------------------------------------------------------------------
    // ACCIÓN 2: configure / save_config (CIFRADO ESTRICTO EN SERVIDOR)
    // ------------------------------------------------------------------------
    if (action === "configure" || action === "save_config") {
      const input = body?.config || {};
      const current = await readCurrentConfig();

      const rawSecret = String(input.client_secret || "").trim();
      const rawApimKey = String(input.apim_subscription_key || "").trim();

      let finalSecretEncrypted = current?.client_secret_encrypted || null;
      let finalApimEncrypted = current?.apim_subscription_key_encrypted || null;

      // Cifrado servidor de ClientSecret con AES-256-GCM y verificación AAD
      if (rawSecret && rawSecret !== "••••••••••••••••") {
        const aad = `${tenantId}|ihce|client_secret|v1`;
        const envelope = await encryptSecret(rawSecret, aad);
        finalSecretEncrypted = JSON.stringify(envelope);
      }

      // Cifrado servidor de APIMsubkey con AES-256-GCM y verificación AAD
      if (rawApimKey && rawApimKey !== "••••••••••••••••") {
        const aad = `${tenantId}|ihce|apim_key|v1`;
        const envelope = await encryptSecret(rawApimKey, aad);
        finalApimEncrypted = JSON.stringify(envelope);
      }

      const payload = {
        tenant_id: tenantId,
        codigo_habilitacion_reps: String(input.codigo_habilitacion_reps || "").trim(),
        codigo_sede_reps: String(input.codigo_sede_reps || "01").trim(),
        codigo_servicio_reps: String(input.codigo_servicio_reps || "334").trim(),
        nombre_prestador: String(input.nombre_prestador || "").trim(),
        nit: String(input.nit || "").trim(),
        ambiente: String(input.ambiente || "SANDBOX_MOCK").trim(),
        client_id: String(input.client_id || "").trim(),
        tenant_id_auth: input.tenant_id_auth ? String(input.tenant_id_auth).trim() : null,
        scope: input.scope ? String(input.scope).trim() : null,
        api_fhir_endpoint: input.api_fhir_endpoint ? String(input.api_fhir_endpoint).trim() : null,
        token_endpoint: input.token_endpoint ? String(input.token_endpoint).trim() : null,
        client_secret_encrypted: finalSecretEncrypted,
        apim_subscription_key_encrypted: finalApimEncrypted,
        is_active: input.is_active === true,
        auto_dispatch_enabled: input.auto_dispatch_enabled !== false,
        updated_at: new Date().toISOString(),
      };

      const { data: savedRow, error: saveErr } = await admin
        .from("ihce_configurations")
        .upsert(payload, { onConflict: "tenant_id" })
        .select("id, tenant_id, codigo_habilitacion_reps, ambiente, is_active")
        .single();

      if (saveErr) throw saveErr;

      // Auditoría sin exponer secretos
      await admin.from("audit_logs").insert({
        tenant_id: tenantId,
        user_id: authData.user.id,
        action: "IHCE_CONFIGURATION_CONFIGURED_SERVER",
        target_type: "ihce_configurations",
        target_id: tenantId,
        details: {
          reps_code: payload.codigo_habilitacion_reps,
          ambiente: payload.ambiente,
          is_active: payload.is_active,
          secret_updated: Boolean(rawSecret && rawSecret !== "••••••••••••••••"),
          apim_key_updated: Boolean(rawApimKey && rawApimKey !== "••••••••••••••••"),
          encrypted_server_aes_256_gcm: true,
        },
      }).catch((e: Error) => console.warn("Aviso auditoría:", e.message));

      return json({
        success: true,
        message: "Configuración de interoperabilidad IHCE guardada y cifrada en el servidor.",
        configured: Boolean(payload.client_id && finalSecretEncrypted),
      });
    }

    // ------------------------------------------------------------------------
    // ACCIÓN 3: test_connectivity (VERIFICACIÓN SERVIDOR SIN EXPOSICIÓN)
    // ------------------------------------------------------------------------
    if (action === "test_connectivity") {
      const startTime = Date.now();
      const input = body?.credentials || body?.config || {};
      const ambiente = String(input.ambiente || "SANDBOX_MOCK");

      // 1. Simulación Aislada
      if (ambiente === "SANDBOX_MOCK") {
        await new Promise((r) => setTimeout(r, 450));
        return json({
          success: true,
          status: 200,
          latencyMs: Date.now() - startTime,
          category: "SIMULACION_EXITOSA",
          message: "Conexión exitosa simulada con el Mecanismo Nacional (Ambiente Local Aislado).",
        });
      }

      // 2. Salvaguarda Absoluta de Producción
      if (ambiente === "PRODUCCION") {
        return json({
          success: false,
          status: 403,
          category: "BLOQUEADO_SALVAGUARDA",
          message: "El ambiente de Producción está estrictamente bloqueado hasta la emisión del visto bueno oficial de MinSalud.",
        }, 403);
      }

      // 3. Preproducción MinSalud (Microsoft Entra ID OAuth2)
      if (ambiente === "PRUEBAS_MINSALUD") {
        const current = await readCurrentConfig();
        const tenantIdAuth = String(input.tenant_id_auth || current?.tenant_id_auth || "").trim();
        const clientId = String(input.client_id || current?.client_id || "").trim();

        // Obtener secreto: si el usuario escribió uno nuevo, usarlo; de lo contrario, descifrar el almacenado
        let clientSecret = "";
        const rawSecret = String(input.client_secret || "").trim();
        if (rawSecret && rawSecret !== "••••••••••••••••") {
          clientSecret = rawSecret;
        } else if (current?.client_secret_encrypted) {
          try {
            const envelope: EncryptedEnvelope = typeof current.client_secret_encrypted === "string"
              ? JSON.parse(current.client_secret_encrypted)
              : current.client_secret_encrypted;
            const aad = `${tenantId}|ihce|client_secret|v1`;
            clientSecret = await decryptSecret(envelope, aad);
          } catch (decErr) {
            throw new HttpError(400, "No fue posible descifrar el ClientSecret almacenado en el servidor.");
          }
        }

        if (!tenantIdAuth || !clientId || !clientSecret) {
          throw new HttpError(400, "Credenciales incompletas para la prueba (TenantID, ClientID y ClientSecret son obligatorios).");
        }

        const tokenUrl = `https://login.microsoftonline.com/${tenantIdAuth}/oauth2/v2.0/token`;
        const scope = String(input.scope || current?.scope || `${clientId}/.default`).trim();

        const formParams = new URLSearchParams();
        formParams.append("grant_type", "client_credentials");
        formParams.append("client_id", clientId);
        formParams.append("client_secret", clientSecret);
        formParams.append("scope", scope);

        const tokenResponse = await fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formParams.toString(),
        });

        const tokenData = await tokenResponse.json().catch(() => ({}));
        const latencyMs = Date.now() - startTime;

        if (!tokenResponse.ok) {
          return json({
            success: false,
            status: tokenResponse.status,
            latencyMs,
            category: "ERROR_AUTENTICACION_MINSALUD",
            message: `Microsoft Entra ID rechazó la autenticación (HTTP ${tokenResponse.status}): ${tokenData?.error_description || tokenData?.error || "Error desconocido"}`,
          });
        }

        // Cero tokens enviados al frontend
        return json({
          success: true,
          status: 200,
          latencyMs,
          category: "AUTENTICACION_EXITOSA_MINSALUD",
          message: `Autenticación exitosa con Microsoft Entra ID (HTTP 200). Bearer token validado en el servidor con vigencia de ${tokenData?.expires_in || 3600} segundos.`,
        });
      }

      throw new HttpError(400, "Ambiente desconocido especificado.");
    }

    // ------------------------------------------------------------------------
    // ACCIÓN 4: get_outbox
    // ------------------------------------------------------------------------
    if (action === "get_outbox") {
      const limit = Math.min(100, Math.max(1, Number(body?.limit) || 50));
      const { data, error } = await admin
        .from("ihce_outbox_queue")
        .select(`
          id,
          evolution_id,
          paciente_id,
          status,
          radicado_oficial,
          ultimo_http_status,
          intentos,
          max_intentos,
          ultimo_error,
          created_at,
          updated_at,
          pacientes (
            nombres,
            apellidos,
            tipo_documento,
            documento
          )
        `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return json({ success: true, items: data || [] });
    }

    // ------------------------------------------------------------------------
    // ACCIÓN 5: retry_outbox
    // ------------------------------------------------------------------------
    if (action === "retry_outbox") {
      const itemId = String(body?.itemId || "").trim();
      if (!itemId) throw new HttpError(400, "itemId es obligatorio.");

      const { data, error } = await admin
        .from("ihce_outbox_queue")
        .update({
          status: "PENDIENTE",
          intentos: 0,
          ultimo_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) throw error;
      return json({ success: true, item: data });
    }

    throw new HttpError(400, `Operación desconocida: ${action}`);
  } catch (error) {
    const status = (error && typeof error === "object" && "status" in error && typeof error.status === "number")
      ? error.status
      : 500;
    const message = error instanceof Error ? error.message : "Error interno en el servicio IHCE.";
    console.error("ihce-proxy error:", message);
    return json({ success: false, error: message }, status);
  }
});
