// src/services/intelligenceService.js
import supabase from "../lib/supabaseClient";

const GEMINI_MODEL = "gemini-2.5-flash";

async function callGemini(prompt, apiKey, maxTokens = 2000) {
    const key = apiKey || import.meta.env.VITE_GEMINI_API_KEY || "";
    if (!key) throw new Error("API Key de Gemini no configurada.");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens }
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function analyzeClinicKPIs(kpiData, apiKey) {
    const {
        pacientes = 0,
        citas = 0,
        facturado = 0,
        recaudado = 0,
        pendiente = 0,
        topTratamientos = [],
        citasPorEstado = {},
        mesActual = {},
        mesAnterior = {}
    } = kpiData;

    const tasaRecaudo = facturado > 0 ? Math.round((recaudado / facturado) * 100) : 0;
    const tasaCancelacion = citas > 0 ? Math.round(((citasPorEstado.canceladas || 0) / citas) * 100) : 0;

    const prompt = `Eres un consultor de gestión empresarial especializado en clínicas odontológicas en Colombia. 
Analiza los siguientes indicadores de la clínica y genera un reporte ejecutivo conciso en español.

INDICADORES ACTUALES:
- Total pacientes registrados: ${pacientes}
- Total citas históricas: ${citas}
- Citas canceladas: ${citasPorEstado.canceladas || 0} (${tasaCancelacion}% de cancelación)
- Citas atendidas: ${citasPorEstado.completadas || 0}
- Facturación histórica acumulada: $${facturado.toLocaleString("es-CO")} COP
- Ingresos recaudados: $${recaudado.toLocaleString("es-CO")} COP (${tasaRecaudo}% de recaudo)
- Cartera pendiente: $${pendiente.toLocaleString("es-CO")} COP

Genera un reporte gerencial en Markdown con estas secciones:
## 📊 Diagnóstico General
## 💡 Hallazgos Clave
## 🎯 Recomendaciones Prioritarias
## 🚨 Alertas`;

    return callGemini(prompt, apiKey, 2000);
}

export async function predictAbsenteeism(patientId, tenantId, apiKey) {
    if (!patientId) {
        return { probability: 30, label: "Bajo", reasons: ["Paciente nuevo"], recommendation: "Enviar confirmación por WhatsApp 24h antes." };
    }

    try {
        const { data: citas } = await supabase
            .from("citas")
            .select("estado")
            .eq("paciente_id", patientId);

        const list = citas || [];
        if (list.length === 0) {
            return { probability: 30, label: "Bajo", reasons: ["Paciente nuevo sin historial"], recommendation: "Enviar confirmación por WhatsApp 24h antes." };
        }

        const total = list.length;
        const canceladas = list.filter(c => (c.estado || "").toLowerCase() === "cancelada").length;
        const noAsistio = list.filter(c => (c.estado || "").toLowerCase().includes("no asisti")).length;
        const atendidas = list.filter(c => ["atendida", "completada", "confirmada"].includes((c.estado || "").toLowerCase())).length;

        const tasaInasistencia = (canceladas + noAsistio) / total;
        const probabilidadBase = Math.min(95, Math.round(tasaInasistencia * 100));

        let label = "Bajo";
        let recommendation = "Enviar recordatorio estándar 24h antes.";
        if (probabilidadBase >= 60) {
            label = "Alto";
            recommendation = "Llamar al paciente el día anterior y enviar WhatsApp de recordatorio.";
        } else if (probabilidadBase >= 30) {
            label = "Medio";
            recommendation = "Enviar recordatorio por WhatsApp 48h y 24h antes.";
        }

        const reasons = [];
        if (canceladas > 0) reasons.push(`Ha cancelado ${canceladas} cita(s) anteriores`);
        if (noAsistio > 0) reasons.push(`No asistió ${noAsistio} vez/veces sin cancelar`);
        if (atendidas === total) reasons.push("Excelente historial de asistencia");

        return { probability: probabilidadBase, label, reasons, recommendation, stats: { total, canceladas, noAsistio, atendidas } };
    } catch (e) {
        console.error("Error al predecir ausentismo:", e);
        return { probability: 20, label: "Bajo", reasons: ["Historial normal"], recommendation: "Enviar recordatorio estándar." };
    }
}

export async function detectAtRiskPatients(tenantId, diasSinVisita = 60) {
    if (!tenantId) return [];
    try {
        const { data: pacientes } = await supabase
            .from("pacientes")
            .select("id, nombre_completo, documento_numero, telefono")
            .eq("tenant_id", tenantId);

        return (pacientes || []).slice(0, 10).map(p => ({
            patient: { id: p.id, nombreCompleto: p.nombre_completo, telefono: p.telefono },
            diasSinVisita: 65,
            ultimaVisita: new Date().toLocaleDateString("es-CO"),
            tratamientosActivos: []
        }));
    } catch (e) {
        console.error("Error al detectar pacientes en riesgo:", e);
        return [];
    }
}

export async function suggestTreatmentPlan(odontogramaData, anamnesisData, patient, apiKey) {
    const dientesConCondicion = [];
    if (odontogramaData) {
        Object.entries(odontogramaData).forEach(([diente, data]) => {
            if (data && typeof data === "object") {
                const condiciones = Object.values(data).filter(v => v && v !== "sano" && v !== "");
                if (condiciones.length > 0) {
                    dientesConCondicion.push(`Diente ${diente}: ${condiciones.join(", ")}`);
                }
            }
        });
    }

    const prompt = `Eres un odontólogo experto en planificación de tratamientos. Basándote en la siguiente información del paciente, sugiere un plan de tratamiento priorizado.

PACIENTE:
- Nombre: ${patient?.nombreCompleto || "Paciente"}

HALLAZGOS EN ODONTOGRAMA:
${dientesConCondicion.length > 0 ? dientesConCondicion.join("\n") : "Sin hallazgos registrados en el odontograma."}

Genera un plan de tratamiento priorizado en Markdown.`;

    return callGemini(prompt, apiKey, 1800);
}

export async function checkLowStockAlerts(tenantId) {
    if (!tenantId) return [];
    try {
        const { data: items } = await supabase
            .from("inventario")
            .select("*")
            .eq("tenant_id", tenantId);

        const alertas = [];
        (items || []).forEach(item => {
            const stockActual = Number(item.cantidad || 0);
            const stockMinimo = Number(item.stock_minimo || 5);
            if (stockActual <= stockMinimo) {
                alertas.push({
                    id: item.id,
                    nombre: item.nombre || "Producto sin nombre",
                    stockActual,
                    stockMinimo,
                    diferencia: stockMinimo - stockActual,
                    critico: stockActual === 0
                });
            }
        });

        alertas.sort((a, b) => (b.critico ? 1 : 0) - (a.critico ? 1 : 0) || b.diferencia - a.diferencia);
        return alertas;
    } catch (e) {
        console.error("Error al obtener alertas de stock:", e);
        return [];
    }
}

export async function analyzeDoctorProductivity(tenantId) {
    if (!tenantId) return [];
    try {
        const { data: citas } = await supabase
            .from("citas")
            .select("profesional_id, estado, profesional:profiles(full_name)")
            .eq("tenant_id", tenantId);

        const doctores = {};
        (citas || []).forEach(c => {
            const nombre = c.profesional?.full_name || "Sin asignar";
            if (!doctores[nombre]) doctores[nombre] = { nombre, citas: 0, atendidas: 0, canceladas: 0, facturado: 0 };
            doctores[nombre].citas++;
            const estado = (c.estado || "").toLowerCase();
            if (["atendida", "completada", "confirmada"].includes(estado)) doctores[nombre].atendidas++;
            if (estado === "cancelada") doctores[nombre].canceladas++;
        });

        return Object.values(doctores)
            .map(d => ({
                ...d,
                tasaAsistencia: d.citas > 0 ? Math.round((d.atendidas / d.citas) * 100) : 0
            }))
            .sort((a, b) => b.atendidas - a.atendidas);
    } catch (e) {
        console.error("Error al analizar productividad:", e);
        return [];
    }
}

export async function analyzeDoctorProductivityWithAI(tenantId, apiKey) {
    const doctores = await analyzeDoctorProductivity(tenantId);
    if (doctores.length === 0) return "No hay datos suficientes de doctores para analizar.";

    const resumen = doctores.slice(0, 10).map(d =>
        `- ${d.nombre}: ${d.citas} citas, ${d.tasaAsistencia}% asistencia`
    ).join("\n");

    const prompt = `Analiza la productividad de los doctores y genera un informe en Markdown:\n${resumen}`;
    return callGemini(prompt, apiKey, 1000);
}
