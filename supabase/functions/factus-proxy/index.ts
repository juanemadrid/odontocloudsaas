import { createClient } from "npm:@supabase/supabase-js@2";

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const factusError = (data: any, status: number) => {
  const errs = data?.data?.errors || data?.errors || data?.data?.error || data?.error;
  if (errs && typeof errs === "object") {
    return Object.entries(errs)
      .map(([field, messages]) => {
        const msg = Array.isArray(messages) ? messages.join(", ") : String(messages);
        return `${field}: ${msg}`;
      })
      .join(" | ");
  }
  if (typeof data?.data === "string") return data.data;
  return data?.message || data?.error_description || "Error Factus HTTP " + status;
};

const baseUrlFor = (testMode: boolean) =>
  testMode ? "https://api-sandbox.factus.com.co" : "https://api.factus.com.co";

Deno.serve(async (request) => {
  let admin: ReturnType<typeof createClient> | null = null;
  let auditTenantId: string | null = null;
  let auditUserId: string | null = null;
  let auditAction = "unknown";
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ success: false, error: "Metodo no permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new HttpError(500, "La funcion no tiene configuradas sus credenciales internas.");
    }

    const authorization = request.headers.get("Authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Debes iniciar sesion.");

    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) throw new HttpError(401, "La sesion no es valida.");

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("tenant_id, role, activo")
      .eq("id", authData.user.id)
      .single();
    if (profileError || !profile || profile.activo === false || !profile.tenant_id) {
      throw new HttpError(403, "Tu perfil no puede utilizar facturacion electronica.");
    }

    const body = await request.json();
    const action = String(body?.action || "");
    auditAction = action;
    const role = String(profile.role || "").trim().toLowerCase();
    const isSuperadmin = role === "superadmin";
    const isAdmin = ["admin", "administrador", "superadmin"].includes(role);
    const tenantId = isSuperadmin && body?.tenantId
      ? String(body.tenantId)
      : String(profile.tenant_id);
    auditTenantId = tenantId;
    auditUserId = authData.user.id;

    if (!isSuperadmin && body?.tenantId && String(body.tenantId) !== String(profile.tenant_id)) {
      throw new HttpError(403, "No puedes usar credenciales de otra clinica.");
    }

    const readConfig = async () => {
      const { data, error } = await admin
        .from("tenant_secrets")
        .select("factus_config")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data?.factus_config || {};
    };

    const normalizeConfig = (input: any, existing: any = {}) => {
      const next = { ...existing };
      const stringFields = [
        "factusClientId",
        "factusClientSecret",
        "factusUsername",
        "factusPassword",
        "factusNumberingRangeId",
        "factusNumberingRangeIdDocSoporte",
      ];
      for (const field of stringFields) {
        if (input?.[field] !== undefined && String(input[field]).trim()) {
          next[field] = String(input[field]).trim();
        }
      }
      if (input?.factusTestMode !== undefined) next.factusTestMode = input.factusTestMode === true;
      if (input?.facturacionCuota !== undefined) {
        next.facturacionCuota = Math.max(0, Number(input.facturacionCuota) || 0);
      }
      if (input?.facturacionUsadas !== undefined) {
        next.facturacionUsadas = Math.max(0, Number(input.facturacionUsadas) || 0);
      }
      if (input?.facturacionPlan !== undefined) {
        next.facturacionPlan = String(input.facturacionPlan || "personalizado");
      }
      return next;
    };

    const hasCredentials = (config: any) =>
      Boolean(
        config?.factusClientId &&
        config?.factusClientSecret &&
        config?.factusUsername &&
        config?.factusPassword
      );

    const fetchToken = async (config: any) => {
      if (!hasCredentials(config)) {
        throw new HttpError(409, "La clinica no tiene credenciales Factus completas.");
      }
      const params = new URLSearchParams({
        grant_type: "password",
        client_id: config.factusClientId,
        client_secret: config.factusClientSecret,
        username: config.factusUsername,
        password: config.factusPassword,
      });
      const response = await fetch(baseUrlFor(config.factusTestMode !== false) + "/oauth/token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token) {
        throw new HttpError(response.status, factusError(data, response.status));
      }
      return data.access_token as string;
    };

    const factusRequest = async (
      config: any,
      path: string,
      options: RequestInit = {},
      accept = "application/json",
    ) => {
      const accessToken = await fetchToken(config);
      const response = await fetch(baseUrlFor(config.factusTestMode !== false) + path, {
        ...options,
        headers: {
          Accept: accept,
          Authorization: "Bearer " + accessToken,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
      });
      return response;
    };

    if (action === "status") {
      const config = await readConfig();
      return json({
        success: true,
        configured: hasCredentials(config),
        factusTestMode: config.factusTestMode !== false,
        factusNumberingRangeId: config.factusNumberingRangeId || null,
        factusNumberingRangeIdDocSoporte: config.factusNumberingRangeIdDocSoporte || null,
        facturacionCuota: Number(config.facturacionCuota || 0),
        facturacionUsadas: Number(config.facturacionUsadas || 0),
        facturacionPlan: config.facturacionPlan || "personalizado",
      });
    }

    if (action === "configure") {
      if (!isAdmin) throw new HttpError(403, "Solo un administrador puede configurar Factus.");
      const existing = await readConfig();
      const config = normalizeConfig(body?.config || {}, existing);
      if (body?.clearCredentials === true) {
        delete config.factusClientId;
        delete config.factusClientSecret;
        delete config.factusUsername;
        delete config.factusPassword;
      }
      const { error } = await admin.from("tenant_secrets").upsert({
        tenant_id: tenantId,
        factus_config: config,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id" });
      if (error) throw error;
      return json({ success: true, configured: hasCredentials(config) });
    }

    if (action === "test") {
      if (!isAdmin) throw new HttpError(403, "Solo un administrador puede probar credenciales.");
      const existing = await readConfig();
      const config = normalizeConfig(body?.config || {}, existing);
      await fetchToken(config);
      return json({ success: true, message: "Conexion establecida con exito." });
    }

    const config = await readConfig();

    if (action === "ranges") {
      const response = await factusRequest(config, "/v2/numbering-ranges");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new HttpError(response.status, factusError(data, response.status));
      return json({ success: true, result: data });
    }

    if (action === "send_bill") {
      const payload = body?.payload;
      const serialized = JSON.stringify(payload || {});
      if (!payload || serialized.length > 500000) {
        throw new HttpError(400, "La factura es invalida o demasiado grande.");
      }

      if (payload?.operation_type === "SS-CUFE") {
        const { data: flagRow, error: flagError } = await admin
          .from("tenant_feature_flags")
          .select("enabled")
          .eq("tenant_id", tenantId)
          .eq("feature_key", "ENABLE_FEV_RIPS_0948")
          .maybeSingle();

        if (flagError) {
          console.error("Error verificando feature flag FEV-RIPS:", flagError.message);
          throw new HttpError(500, "Error verificando autorizacion regulatoria.");
        }

        if (flagRow?.enabled !== true) {
          throw new HttpError(403, "FEV-RIPS 0948 no esta habilitado para esta institucion.");
        }
      }

      const quota = Number(config.facturacionCuota || 0);
      const used = Number(config.facturacionUsadas || 0);
      if (quota > 0 && used >= quota) {
        throw new HttpError(402, "La clinica alcanzo su cuota de facturas.");
      }

      const response = await factusRequest(config, "/v2/bills/validate", {
        method: "POST",
        body: serialized,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new HttpError(response.status, factusError(data, response.status));

      await admin.from("tenant_secrets").update({
        factus_config: { ...config, facturacionUsadas: used + 1 },
        updated_at: new Date().toISOString(),
      }).eq("tenant_id", tenantId);

      return json({ success: true, result: data });
    }

    if (action === "send_support_document") {
      let payload = body?.payload;
      if (!payload || typeof payload !== "object") {
        throw new HttpError(400, "El documento soporte es invalido.");
      }

      // Auto-completar numbering_range_id si no fue enviado desde el cliente
      if (!payload.numbering_range_id) {
        if (config.factusNumberingRangeIdDocSoporte) {
          payload.numbering_range_id = Number(config.factusNumberingRangeIdDocSoporte);
        } else if (config.factusNumberingRangeId) {
          payload.numbering_range_id = Number(config.factusNumberingRangeId);
        }
      }

      // Asegurar due_date en payment_details (obligatorio en Factus V2)
      if (Array.isArray(payload.payment_details) && payload.payment_details[0]) {
        if (!payload.payment_details[0].due_date) {
          payload.payment_details[0].due_date = new Date().toISOString().split("T")[0];
        }
      }

      const serialized = JSON.stringify(payload);
      if (serialized.length > 500000) {
        throw new HttpError(400, "El documento soporte es demasiado grande.");
      }

      const quota = Number(config.facturacionCuota || 0);
      const used = Number(config.facturacionUsadas || 0);
      if (quota > 0 && used >= quota) {
        throw new HttpError(402, "La clinica alcanzo su cuota de folios DIAN.");
      }

      const response = await factusRequest(config, "/v2/support-documents/validate", {
        method: "POST",
        body: serialized,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new HttpError(response.status, factusError(data, response.status));

      await admin.from("tenant_secrets").update({
        factus_config: { ...config, facturacionUsadas: used + 1 },
        updated_at: new Date().toISOString(),
      }).eq("tenant_id", tenantId);

      return json({ success: true, result: data });
    }

    if (action === "send_adjustment_note") {
      const payload = body?.payload;
      const serialized = JSON.stringify(payload || {});
      if (!payload || serialized.length > 500000) {
        throw new HttpError(400, "La nota de ajuste es invalida o demasiado grande.");
      }

      const response = await factusRequest(config, "/v2/adjustment-notes/validate", {
        method: "POST",
        body: serialized,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new HttpError(response.status, factusError(data, response.status));

      return json({ success: true, result: data });
    }

    if (action === "send_credit_note") {
      const payload = body?.payload;
      const serialized = JSON.stringify(payload || {});
      if (!payload || serialized.length > 500000) {
        throw new HttpError(400, "La nota de credito es invalida o demasiado grande.");
      }

      if (payload?.operation_type === "SS-CUFE") {
        const { data: flagRow, error: flagError } = await admin
          .from("tenant_feature_flags")
          .select("enabled")
          .eq("tenant_id", tenantId)
          .eq("feature_key", "ENABLE_FEV_RIPS_0948")
          .maybeSingle();

        if (flagError) {
          console.error("Error verificando feature flag FEV-RIPS:", flagError.message);
          throw new HttpError(500, "Error verificando autorizacion regulatoria.");
        }

        if (flagRow?.enabled !== true) {
          throw new HttpError(403, "FEV-RIPS 0948 no esta habilitado para esta institucion.");
        }
      }

      const quota = Number(config.facturacionCuota || 0);
      const used = Number(config.facturacionUsadas || 0);
      if (quota > 0 && used >= quota) {
        throw new HttpError(402, "La clinica alcanzo su cuota de folios DIAN.");
      }

      const response = await factusRequest(config, "/v2/credit-notes/validate", {
        method: "POST",
        body: serialized,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new HttpError(response.status, factusError(data, response.status));

      await admin.from("tenant_secrets").update({
        factus_config: { ...config, facturacionUsadas: used + 1 },
        updated_at: new Date().toISOString(),
      }).eq("tenant_id", tenantId);

      return json({ success: true, result: data });
    }

    if (action === "download_credit_note_pdf") {
      const number = String(body?.number || body?.creditNoteNumber || "");
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(number)) {
        throw new HttpError(400, "El numero de Nota Credito no es valido.");
      }
      const response = await factusRequest(
        config,
        "/v2/credit-notes/" + encodeURIComponent(number) + "/download-pdf",
        {},
        "application/pdf",
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new HttpError(response.status, factusError(data, response.status));
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return json({ success: true, base64: btoa(binary), mimeType: "application/pdf" });
    }

    if (action === "download_credit_note_xml") {
      const number = String(body?.number || body?.creditNoteNumber || "");
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(number)) {
        throw new HttpError(400, "El numero de Nota Credito no es valido.");
      }
      const response = await factusRequest(
        config,
        "/v2/credit-notes/" + encodeURIComponent(number) + "/download-attached-document-xml",
        {},
        "application/json",
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new HttpError(response.status, factusError(data, response.status));

      const rawBase64 = data?.data?.xml_base_64_encoded || data?.xml_base_64_encoded || data?.data?.file || "";
      if (!rawBase64) {
        throw new HttpError(502, "Factus no retorno el XML del AttachedDocument de la Nota Credito.");
      }

      return json({
        success: true,
        credit_note_number: number,
        xml_base_64_encoded: rawBase64,
        file_name: data?.data?.file_name || null,
      });
    }

    if (action === "check_credit_note") {
      const number = body?.number ? String(body.number).trim() : null;
      const referenceCode = body?.referenceCode ? String(body.referenceCode).trim() : null;

      if (!number && !referenceCode) {
        throw new HttpError(400, "Debe proporcionar number o referenceCode de la Nota Credito.");
      }

      let path = "";
      if (number) {
        path = "/v2/credit-notes/" + encodeURIComponent(number);
      } else {
        path = "/v2/credit-notes?filter[reference_code]=" + encodeURIComponent(referenceCode!);
      }

      const response = await factusRequest(config, path);
      if (response.status === 404) {
        return json({ success: true, exists: false, not_found: true });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new HttpError(response.status, factusError(data, response.status));
      }

      let cnData = null;
      if (number) {
        cnData = data?.data?.credit_note || data?.credit_note || data?.data || null;
      } else if (Array.isArray(data?.data?.data)) {
        cnData = data.data.data[0] || null;
      } else if (Array.isArray(data?.data)) {
        cnData = data.data[0] || null;
      }

      const exists = Boolean(cnData);
      return json({
        success: true,
        exists,
        not_found: !exists,
        result: cnData ? { credit_note: cnData } : null,
      });
    }

    if (action === "delete_unvalidated_credit_note") {
      const referenceCode = body?.referenceCode ? String(body.referenceCode).trim() : null;
      if (!referenceCode) {
        throw new HttpError(400, "Debe proporcionar el referenceCode para consultar la Nota Credito.");
      }

      // 1: Verificar el estado actual en Factus
      const checkPath = "/v2/credit-notes?filter[reference_code]=" + encodeURIComponent(referenceCode);
      const checkResp = await factusRequest(config, checkPath);

      if (checkResp.status === 404) {
        return json({
          success: true,
          deleted: true,
          already_absent: true,
          reference_code: referenceCode,
          message: "La Nota Credito no existe en Factus; lista para emision limpia.",
        });
      }

      const checkData = await checkResp.json().catch(() => ({}));
      let cnData = null;
      if (Array.isArray(checkData?.data?.data)) {
        cnData = checkData.data.data[0] || null;
      } else if (Array.isArray(checkData?.data)) {
        cnData = checkData.data[0] || null;
      } else if (checkData?.data?.credit_note) {
        cnData = checkData.data.credit_note;
      }

      if (!cnData) {
        return json({
          success: true,
          deleted: true,
          already_absent: true,
          reference_code: referenceCode,
          message: "La Nota Credito no fue encontrada en Factus.",
        });
      }

      // 2: Guardia estricta: NUNCA permitir eliminacion si existe CUDE o validacion DIAN
      const cude = cnData.cude || null;
      const isValidated =
        cnData.is_validated === true ||
        cnData.is_validated === 1 ||
        String(cnData.status || "").toUpperCase() === "ACEPTADA";

      if (cude || isValidated) {
        throw new HttpError(
          400,
          "CUDE_EXISTS_DELETE_BLOCKED: No se puede eliminar una Nota Credito con CUDE fiscal o validada ante la DIAN."
        );
      }

      // 3: Factus API v2 no expone DELETE para notas de credito
      return json({
        success: true,
        deleted: false,
        not_supported: true,
        reference_code: referenceCode,
        message: "Factus API v2 no admite eliminacion fisica de Notas Credito. Se debe reconciliar o conservar el reference_code.",
      });
    }

    if (action === "download_pdf") {
      const billNumber = String(body?.billNumber || "");
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(billNumber)) {
        throw new HttpError(400, "El numero de factura no es valido.");
      }
      const response = await factusRequest(
        config,
        "/v2/bills/" + encodeURIComponent(billNumber) + "/download-pdf",
        {},
        "application/pdf",
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new HttpError(response.status, factusError(data, response.status));
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return json({ success: true, base64: btoa(binary), mimeType: "application/pdf" });
    }

    if (action === "download_attached_document") {
      const billNumber = String(body?.billNumber || "");
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(billNumber)) {
        throw new HttpError(400, "El numero de factura no es valido.");
      }
      const response = await factusRequest(
        config,
        "/v2/bills/" + encodeURIComponent(billNumber) + "/download-attached-document-xml",
        {},
        "application/json",
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new HttpError(response.status, factusError(data, response.status));

      const rawBase64 = data?.data?.xml_base_64_encoded || data?.xml_base_64_encoded || data?.data?.file || "";
      if (!rawBase64) {
        throw new HttpError(502, "Factus no retorno el XML del AttachedDocument.");
      }

      return json({
        success: true,
        bill_number: billNumber,
        xml_base_64_encoded: rawBase64,
      });
    }

    if (action === "download_support_document_pdf") {
      const number = String(body?.number || "");
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(number)) {
        throw new HttpError(400, "El numero de documento soporte no es valido.");
      }
      const response = await factusRequest(
        config,
        "/v2/support-documents/" + encodeURIComponent(number) + "/download-pdf",
        {},
        "application/pdf",
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new HttpError(response.status, factusError(data, response.status));
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return json({ success: true, base64: btoa(binary), mimeType: "application/pdf" });
    }

    if (action === "get_support_document") {
      const number = body?.number ? String(body.number).trim() : null;
      const referenceCode = body?.referenceCode ? String(body.referenceCode).trim() : null;

      if (!number && !referenceCode) {
        throw new HttpError(400, "Debe proporcionar number o referenceCode del documento soporte.");
      }

      let path = "";
      if (number) {
        path = "/v2/support-documents/" + encodeURIComponent(number);
      } else {
        path = "/v2/support-documents?filter[reference_code]=" + encodeURIComponent(referenceCode!);
      }

      const response = await factusRequest(config, path);
      if (response.status === 404) {
        return json({ success: true, exists: false, not_found: true });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new HttpError(response.status, factusError(data, response.status));
      }

      let docData = null;
      if (number) {
        docData = data?.data?.support_document || data?.data || data?.support_document || null;
      } else if (Array.isArray(data?.data?.data)) {
        docData = data.data.data[0] || null;
      } else if (Array.isArray(data?.data)) {
        docData = data.data[0] || null;
      }

      const exists = Boolean(docData);
      return json({
        success: true,
        exists,
        not_found: !exists,
        result: docData ? { support_document: docData } : null,
      });
    }

    if (action === "check_bill") {
      const billNumber = body?.billNumber ? String(body.billNumber).trim() : null;
      const referenceCode = body?.referenceCode ? String(body.referenceCode).trim() : null;

      if (!billNumber && !referenceCode) {
        throw new HttpError(400, "Debe proporcionar billNumber o referenceCode.");
      }

      let path = "";
      if (billNumber) {
        path = "/v2/bills/show/" + encodeURIComponent(billNumber);
      } else {
        path = "/v2/bills?filter[reference_code]=" + encodeURIComponent(referenceCode!);
      }

      const response = await factusRequest(config, path);
      if (response.status === 404) {
        return json({ success: true, exists: false, not_found: true });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new HttpError(response.status, factusError(data, response.status));
      }

      let billData = null;
      if (billNumber) {
        billData = data?.data?.bill || data?.bill || data?.data || null;
      } else if (Array.isArray(data?.data?.data)) {
        billData = data.data.data[0] || null;
      } else if (Array.isArray(data?.data)) {
        billData = data.data[0] || null;
      }

      const exists = Boolean(billData);
      return json({
        success: true,
        exists,
        not_found: !exists,
        result: billData ? { bill: billData } : null,
      });
    }

    if (action === "delete_unvalidated_bill") {
      const referenceCode = body?.referenceCode ? String(body.referenceCode).trim() : null;
      if (!referenceCode) {
        throw new HttpError(400, "Debe proporcionar el referenceCode para eliminar la factura.");
      }

      // Step 1: Query Factus to verify the invoice state
      const checkPath = "/v2/bills?filter[reference_code]=" + encodeURIComponent(referenceCode);
      const checkResp = await factusRequest(config, checkPath);

      if (checkResp.status === 404) {
        return json({
          success: true,
          deleted: true,
          already_absent: true,
          reference_code: referenceCode,
          message: "La factura no existe en Factus; lista para emisión limpia.",
        });
      }

      const checkData = await checkResp.json().catch(() => ({}));
      let billData = null;
      if (Array.isArray(checkData?.data?.data)) {
        billData = checkData.data.data[0] || null;
      } else if (Array.isArray(checkData?.data)) {
        billData = checkData.data[0] || null;
      } else if (checkData?.data?.bill) {
        billData = checkData.data.bill;
      }

      if (!billData) {
        return json({
          success: true,
          deleted: true,
          already_absent: true,
          reference_code: referenceCode,
          message: "La factura no fue encontrada en Factus; lista para nueva emisión.",
        });
      }

      // Step 2: Strict fiscal guards: NEVER delete validated or CUFE bills
      const cufe = billData.cufe || billData.cude || null;
      if (cufe) {
        throw new HttpError(
          400,
          "CUFE_EXISTS_DELETE_BLOCKED: No se puede eliminar una factura que ya posee CUFE fiscal. Requiere Nota Crédito."
        );
      }

      const isValidated =
        billData.is_validated === true ||
        billData.is_validated === 1 ||
        String(billData.status || "").toUpperCase() === "ACEPTADA";

      if (isValidated) {
        throw new HttpError(
          400,
          "VALIDATED_BILL_DELETE_BLOCKED: No se puede eliminar una factura validada por la DIAN. Requiere Nota Crédito."
        );
      }

      // Step 3: Call official Factus deletion endpoint
      const deletePath = "/v2/bills/destroy/reference/" + encodeURIComponent(referenceCode);
      const deleteResp = await factusRequest(config, deletePath, { method: "DELETE" });
      const deleteData = await deleteResp.json().catch(() => ({}));

      if (!deleteResp.ok && deleteResp.status !== 404) {
        throw new HttpError(deleteResp.status, factusError(deleteData, deleteResp.status));
      }

      // Step 4: Audit log
      if (admin && tenantId) {
        await admin.from("audit_logs").insert({
          tenant_id: tenantId,
          inquilino: tenantId,
          performed_by: auditUserId || "system",
          action: "FACTUS_DELETE_UNVALIDATED",
          details: {
            reference_code: referenceCode,
            invoice_id: body?.invoiceId || null,
            factus_id: billData.id || null,
            factus_number: billData.number || null,
          },
        }).catch(() => {});
      }

      return json({
        success: true,
        deleted: true,
        reference_code: referenceCode,
        message: "Factura pendiente/no validada eliminada exitosamente en Factus.",
      });
    }

    throw new HttpError(400, "Operacion desconocida.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error interno.";
    if (admin && auditTenantId && auditUserId && auditAction !== "status") {
      const { error: auditError } = await admin.from("audit_logs").insert({
        tenant_id: auditTenantId,
        inquilino: auditTenantId,
        performed_by: auditUserId,
        action: "FACTUS_ERROR",
        details: { action: auditAction, status, error: message.slice(0, 500) },
      });
      if (auditError) console.error("factus audit:", auditError.message);
    }
    console.error("factus-proxy:", message);
    return json({ success: false, error: message }, status);
  }
});
