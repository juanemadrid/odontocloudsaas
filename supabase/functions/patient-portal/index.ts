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

const hashValue = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (request) => {
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

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const body = await request.json();
    const action = String(body?.action || "");

    const loadPortalData = async (patientId: string, tenantId: string) => {
      const queryRows = async (table: string, apply: (query: any) => any) => {
        try {
          const { data, error } = await apply(
            admin.from(table).select("*").eq("tenant_id", tenantId)
          );
          if (error) throw error;
          return data || [];
        } catch (error) {
          console.warn("patient-portal query " + table + ":", error);
          return [];
        }
      };

      const [patientResult, appointments, payments, receipts, plans, notifications] =
        await Promise.all([
          admin
            .from("pacientes")
            .select("*")
            .eq("id", patientId)
            .eq("tenant_id", tenantId)
            .single(),
          queryRows("citas", (query) => query.eq("paciente_id", patientId)),
          queryRows("pagos", (query) => query.eq("paciente_id", patientId)),
          queryRows("recibos_caja", (query) => query.eq("paciente_id", patientId)),
          queryRows("treatment_plans", (query) => query.eq("paciente_id", patientId)),
          queryRows("notificaciones", (query) =>
            query.eq("paciente_id", patientId).eq("target", "patient")
              .order("created_at", { ascending: false }).limit(20)
          ),
        ]);

      if (patientResult.error || !patientResult.data) {
        throw new HttpError(404, "No se encontro el paciente.");
      }

      const source = patientResult.data;
      const patient = {
        id: source.id,
        tenant_id: source.tenant_id,
        inquilino: source.tenant_id,
        nombres: source.nombres || source.nombre || "",
        apellidos: source.apellidos || source.apellido || "",
        nombreCompleto: source.nombreCompleto ||
          [source.nombres || source.nombre, source.apellidos || source.apellido]
            .filter(Boolean).join(" "),
        celular: source.celular || source.telefono || "",
        telefono: source.telefono || source.celular || "",
        email: source.email || "",
        fechaNacimiento: source.fecha_nacimiento || source.fechaNacimiento || source.nacimiento || "",
      };

      return {
        patient,
        appointments,
        payments: [...payments, ...receipts],
        plans,
        notifications,
      };
    };

    const validateSession = async () => {
      const sessionToken = String(body?.sessionToken || "");
      if (sessionToken.length < 40) throw new HttpError(401, "La sesion del portal no es valida.");
      const tokenHash = await hashValue(sessionToken);
      const { data: session, error } = await admin
        .from("patient_portal_sessions")
        .select("id, tenant_id, patient_id, expires_at")
        .eq("token_hash", tokenHash)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error || !session) throw new HttpError(401, "La sesion expiro. Ingresa nuevamente.");
      return { ...session, tokenHash };
    };

    if (action === "login") {
      const document = String(body?.document || "").replace(/\D/g, "");
      const birthDate = String(body?.birthDate || "");
      const tenantId = String(body?.tenantId || "");
      const clinicSlug = String(body?.clinicSlug || "").trim().toLowerCase();

      if (!/^[0-9]{5,20}$/.test(document) || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        throw new HttpError(400, "Los datos de acceso no son validos.");
      }
      if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
        throw new HttpError(400, "La clinica no es valida.");
      }

      const { data: websiteRow } = await admin
        .from("website_config")
        .select("config")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      const configuredSlug = String(websiteRow?.config?.slug || "").trim().toLowerCase();
      if (clinicSlug && configuredSlug && clinicSlug !== configuredSlug) {
        throw new HttpError(401, "Documento o fecha de nacimiento incorrectos.");
      }

      const forwardedFor = request.headers.get("x-forwarded-for") || "unknown";
      const address = forwardedFor.split(",")[0].trim();
      const attemptHash = await hashValue("portal:" + address + ":" + tenantId + ":" + document);
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("registration_attempts")
        .select("id", { count: "exact", head: true })
        .eq("request_hash", attemptHash)
        .gte("attempted_at", since);
      if ((count || 0) >= 5) {
        throw new HttpError(429, "Demasiados intentos. Intenta mas tarde.");
      }
      await admin.from("registration_attempts").insert({ request_hash: attemptHash });

      let patientResult = await admin
        .from("pacientes")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("documento", document)
        .maybeSingle();

      if (patientResult.error || !patientResult.data) {
        patientResult = await admin
          .from("pacientes")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("nroDocumento", document)
          .maybeSingle();
      }

      const patient = patientResult.data;
      const storedBirthDate = String(
        patient?.fecha_nacimiento || patient?.fechaNacimiento || patient?.nacimiento || ""
      ).slice(0, 10);
      if (!patient || storedBirthDate !== birthDate) {
        throw new HttpError(401, "Documento o fecha de nacimiento incorrectos.");
      }

      const sessionToken = crypto.randomUUID() + crypto.randomUUID();
      const tokenHash = await hashValue(sessionToken);
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      const { error: sessionError } = await admin.from("patient_portal_sessions").insert({
        token_hash: tokenHash,
        tenant_id: tenantId,
        patient_id: patient.id,
        expires_at: expiresAt,
      });
      if (sessionError) throw sessionError;

      return json({
        success: true,
        sessionToken,
        expiresAt,
        data: await loadPortalData(patient.id, tenantId),
      });
    }

    if (action === "get_data") {
      const session = await validateSession();
      return json({
        success: true,
        data: await loadPortalData(session.patient_id, session.tenant_id),
      });
    }

    if (action === "request_appointment") {
      const session = await validateSession();
      const preferredDate = String(body?.preferredDate || "");
      const reason = String(body?.reason || "Consulta general").trim().slice(0, 300);
      const phone = String(body?.phone || "").replace(/[^0-9+]/g, "").slice(0, 20);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
        throw new HttpError(400, "La fecha solicitada no es valida.");
      }

      const portalData = await loadPortalData(session.patient_id, session.tenant_id);
      const patientName = portalData.patient.nombreCompleto || "Paciente";
      const { error } = await admin.from("notificaciones").insert([
        {
          tenant_id: session.tenant_id,
          target: "admin",
          title: "Nueva Solicitud de Cita",
          message: patientName + " solicito una cita para " + preferredDate + ". Motivo: " + reason,
          type: "appointment_request",
          paciente_id: session.patient_id,
          paciente_nombre: patientName,
          paciente_celular: phone || portalData.patient.celular,
          fecha_solicitada: preferredDate,
          motivo: reason,
          estado: "pendiente",
          read: false,
        },
        {
          tenant_id: session.tenant_id,
          target: "patient",
          title: "Solicitud recibida",
          message: "Recibimos tu solicitud de cita para " + preferredDate + ".",
          type: "appointment_request_sent",
          paciente_id: session.patient_id,
          read: false,
        },
      ]);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "logout") {
      const session = await validateSession();
      await admin.from("patient_portal_sessions").delete().eq("id", session.id);
      return json({ success: true });
    }

    throw new HttpError(400, "Operacion desconocida.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error interno.";
    if (status >= 500) console.error("patient-portal:", message);
    return json({ success: false, error: message }, status);
  }
});
