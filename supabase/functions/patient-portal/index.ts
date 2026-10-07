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

const normalizeDateToIso = (raw: unknown): string => {
  if (!raw) return "";
  const str = String(raw).trim().split("T")[0].split(" ")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  return str;
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

      const [patientResult, appointments, payments, receipts, plans, notifications, doctorProfiles, websiteRow] =
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
          admin
            .from("profiles")
            .select("id, full_name, email, role, activo")
            .eq("tenant_id", tenantId),
          admin
            .from("website_config")
            .select("config")
            .eq("tenant_id", tenantId)
            .maybeSingle(),
        ]);

      if (patientResult.error || !patientResult.data) {
        throw new HttpError(404, "No se encontro el paciente.");
      }

      // Mapear doctores por ID desde los perfiles reales de la clinica
      const doctorsMap = new Map();
      const doctorsList = [];
      for (const d of doctorProfiles?.data || []) {
        if (d.activo === false) continue;
        const fullName = d.full_name || "Especialista Odontológico";
        const role = String(d.role || "").toLowerCase();
        const specialty = role === "admin"
          ? "Dirección Clínica / Odontología"
          : role.includes("ciruj")
          ? "Cirugía Oral y Maxilofacial"
          : role.includes("orto")
          ? "Ortodoncia y Ortopedia"
          : role.includes("endo")
          ? "Endodoncia"
          : "Odontología Especializada";
        const docData = {
          id: d.id,
          name: fullName,
          specialty,
          role: d.role || "doctor",
        };
        doctorsMap.set(String(d.id), docData);
        doctorsList.push(docData);
      }

      // Datos de la clínica real
      const cfg = websiteRow?.data?.config || {};
      const emp = cfg.empresa_datos || {};
      const clinic = {
        tenantId,
        name: emp.nombreComercial || emp.razonSocial || cfg.name || "ATM Centro del Dolor Orofacial",
        logo: cfg.logo || emp.logoUrl || "",
        phone: emp.celular || emp.telefono || cfg.phone || cfg.contactPhone || "",
        email: emp.email || cfg.email || "",
        address: emp.direccion || cfg.address || "",
        city: emp.ciudad || cfg.city || "Sincelejo",
        primaryColor: cfg.primaryColor || "#1a56db",
      };

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
        alertas: source.alertas || source.alergias || "",
        nroHistoria: source.nro_historia || source.nroHistoria || source.documento || "",
        nombreEps: source.eps || source.nombreEps || "Particular",
      };

      // Enriquecer citas con datos reales de doctor
      const enrichedAppointments = appointments.map((apt: any) => {
        const doc = apt.profesional_id ? doctorsMap.get(String(apt.profesional_id)) : null;
        return {
          ...apt,
          profesional_nombre: apt.profesional_nombre || doc?.name || apt.dentista || apt.doctorName || "Odontólogo Especialista",
          profesional_especialidad: doc?.specialty || apt.especialidad || "Odontología",
        };
      });

      // Enriquecer planes con datos reales de doctor
      const enrichedPlans = plans.map((pl: any) => {
        const doc = pl.doctor_id || pl.profesional_id ? doctorsMap.get(String(pl.doctor_id || pl.profesional_id)) : null;
        return {
          ...pl,
          doctorName: pl.doctorName || pl.profesional_nombre || doc?.name || "Odontólogo Tratante",
          specialty: doc?.specialty || pl.especialidad || "Odontología General",
        };
      });

      return {
        patient,
        clinic,
        doctors: doctorsList,
        appointments: enrichedAppointments,
        payments: [...payments, ...receipts],
        plans: enrichedPlans,
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

    // Helper: Encuentra al paciente de forma flexible por documento
    const findPatient = async (tenantId: string, documentDigits: string) => {
      // 1. Coincidencia directa por campo documento
      let { data: patient } = await admin
        .from("pacientes")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("documento", documentDigits)
        .maybeSingle();

      // 2. Coincidencia por nro_documento
      if (!patient) {
        const { data: byNro } = await admin
          .from("pacientes")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("nro_documento", documentDigits)
          .maybeSingle();
        if (byNro) patient = byNro;
      }

      // 3. Coincidencia flexible si el documento fue guardado con puntos o espacios (ej: 42.209.244)
      if (!patient) {
        const { data: candidates } = await admin
          .from("pacientes")
          .select("*")
          .eq("tenant_id", tenantId)
          .or(`documento.ilike.%${documentDigits}%,nro_documento.ilike.%${documentDigits}%`)
          .limit(10);

        if (candidates && candidates.length > 0) {
          patient = candidates.find((c: any) => {
            const raw = String(c.documento || c.nro_documento || c.nroDocumento || "").replace(/\D/g, "");
            return raw === documentDigits;
          }) || null;
        }
      }

      return patient;
    };

    if (action === "login") {
      const document = String(body?.document || "").replace(/\D/g, "");
      const birthDate = String(body?.birthDate || "").trim();
      const pin = String(body?.pin || "").trim();
      const newPin = String(body?.newPin || "").trim();
      const tenantId = String(body?.tenantId || "");
      const clinicSlug = String(body?.clinicSlug || "").trim().toLowerCase();

      if (!/^[0-9]{5,20}$/.test(document)) {
        throw new HttpError(400, "El número de documento no es válido.");
      }
      if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
        throw new HttpError(400, "La clínica no es válida.");
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
      if ((count || 0) >= 15) {
        throw new HttpError(429, "Demasiados intentos fallidos. Intenta más tarde.");
      }

      const patient = await findPatient(tenantId, document);
      if (!patient) {
        await admin.from("registration_attempts").insert({ request_hash: attemptHash });
        throw new HttpError(401, "Documento no encontrado o no registrado en esta clínica.");
      }

      // Verificar si el paciente tiene PIN configurado
      let existingPinHash: string | null = null;
      try {
        const { data: pinRow } = await admin
          .from("patient_portal_pins")
          .select("pin_hash")
          .eq("tenant_id", tenantId)
          .eq("patient_id", patient.id)
          .maybeSingle();
        if (pinRow?.pin_hash) existingPinHash = pinRow.pin_hash;
      } catch (err) {
        console.warn("patient_portal_pins query (falling back gracefully):", err);
      }

      // CASO A: Paciente ya tiene PIN registrado
      if (existingPinHash) {
        // Si no envió PIN, solicitarlo
        if (!pin) {
          return json({
            success: true,
            hasPin: true,
            requiresPin: true,
            patientName: patient.nombres || patient.nombreCompleto || "Paciente",
          });
        }

        // Validar el PIN
        const enteredPinHash = await hashValue("pin:" + tenantId + ":" + patient.id + ":" + pin);
        if (existingPinHash !== enteredPinHash) {
          await admin.from("registration_attempts").insert({ request_hash: attemptHash });
          throw new HttpError(401, "El PIN ingresado es incorrecto.");
        }
      } else {
        // CASO B: Paciente ingresa por primera vez (Validación por Fecha de Nacimiento)
        if (!birthDate) {
          throw new HttpError(400, "Ingrese su fecha de nacimiento para el primer ingreso.");
        }

        const storedRaw = patient.fecha_nacimiento || patient.fechaNacimiento || patient.nacimiento || "";
        const normalizedStored = normalizeDateToIso(storedRaw);
        const normalizedInput = normalizeDateToIso(birthDate);

        if (normalizedStored && normalizedInput && normalizedStored !== normalizedInput) {
          await admin.from("registration_attempts").insert({ request_hash: attemptHash });
          throw new HttpError(401, "Documento o fecha de nacimiento incorrectos.");
        }

        // Si se envió un newPin para configurarlo de una vez:
        if (newPin && /^\d{4,6}$/.test(newPin)) {
          const pinHashToStore = await hashValue("pin:" + tenantId + ":" + patient.id + ":" + newPin);
          try {
            await admin.from("patient_portal_pins").upsert({
              tenant_id: tenantId,
              patient_id: patient.id,
              pin_hash: pinHashToStore,
              updated_at: new Date().toISOString(),
            }, { onConflict: "tenant_id,patient_id" });
          } catch (pinSaveErr) {
            console.warn("Could not persist patient_portal_pins:", pinSaveErr);
          }
        } else if (!newPin) {
          // Requiere que el paciente defina su PIN para blindaje legal
          const tempToken = crypto.randomUUID() + crypto.randomUUID();
          const tokenHash = await hashValue("temp_pin:" + tempToken);
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          await admin.from("patient_portal_sessions").insert({
            token_hash: tokenHash,
            tenant_id: tenantId,
            patient_id: patient.id,
            expires_at: expiresAt,
          });

          return json({
            success: true,
            requiresPinSetup: true,
            tempToken,
            patientName: patient.nombres || patient.nombreCompleto || "Paciente",
          });
        }
      }

      // Autenticación concedida: Crear sesión
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

    if (action === "setup_pin") {
      const tempToken = String(body?.tempToken || "");
      const pin = String(body?.pin || "").trim();
      const tenantId = String(body?.tenantId || "");

      if (!/^\d{4,6}$/.test(pin)) {
        throw new HttpError(400, "El PIN debe tener 4 dígitos numéricos.");
      }
      if (tempToken.length < 40) {
        throw new HttpError(401, "La sesión temporal expiró. Vuelve a ingresar.");
      }

      const tokenHash = await hashValue("temp_pin:" + tempToken);
      const { data: tempSession, error: tempErr } = await admin
        .from("patient_portal_sessions")
        .select("id, tenant_id, patient_id")
        .eq("token_hash", tokenHash)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (tempErr || !tempSession) {
        throw new HttpError(401, "La sesión temporal de configuración expiró. Vuelve a ingresar.");
      }

      // Guardar PIN
      const pinHashToStore = await hashValue("pin:" + tempSession.tenant_id + ":" + tempSession.patient_id + ":" + pin);
      try {
        await admin.from("patient_portal_pins").upsert({
          tenant_id: tempSession.tenant_id,
          patient_id: tempSession.patient_id,
          pin_hash: pinHashToStore,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,patient_id" });
      } catch (pinErr) {
        console.warn("Could not save pin in patient_portal_pins:", pinErr);
      }

      // Eliminar token temporal
      await admin.from("patient_portal_sessions").delete().eq("id", tempSession.id);

      // Crear sesión real
      const sessionToken = crypto.randomUUID() + crypto.randomUUID();
      const realTokenHash = await hashValue(sessionToken);
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      await admin.from("patient_portal_sessions").insert({
        token_hash: realTokenHash,
        tenant_id: tempSession.tenant_id,
        patient_id: tempSession.patient_id,
        expires_at: expiresAt,
      });

      return json({
        success: true,
        sessionToken,
        expiresAt,
        data: await loadPortalData(tempSession.patient_id, tempSession.tenant_id),
      });
    }

    if (action === "reset_pin") {
      const document = String(body?.document || "").replace(/\D/g, "");
      const birthDate = String(body?.birthDate || "").trim();
      const newPin = String(body?.newPin || "").trim();
      const tenantId = String(body?.tenantId || "");

      if (!/^\d{4,6}$/.test(newPin)) {
        throw new HttpError(400, "El nuevo PIN debe tener 4 dígitos.");
      }

      const patient = await findPatient(tenantId, document);
      if (!patient) throw new HttpError(401, "Documento o fecha de nacimiento incorrectos.");

      const storedRaw = patient.fecha_nacimiento || patient.fechaNacimiento || patient.nacimiento || "";
      const normalizedStored = normalizeDateToIso(storedRaw);
      const normalizedInput = normalizeDateToIso(birthDate);

      if (normalizedStored !== normalizedInput) {
        throw new HttpError(401, "Documento o fecha de nacimiento incorrectos.");
      }

      const pinHashToStore = await hashValue("pin:" + tenantId + ":" + patient.id + ":" + newPin);
      await admin.from("patient_portal_pins").upsert({
        tenant_id: tenantId,
        patient_id: patient.id,
        pin_hash: pinHashToStore,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,patient_id" });

      const sessionToken = crypto.randomUUID() + crypto.randomUUID();
      const tokenHash = await hashValue(sessionToken);
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      await admin.from("patient_portal_sessions").insert({
        token_hash: tokenHash,
        tenant_id: tenantId,
        patient_id: patient.id,
        expires_at: expiresAt,
      });

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
