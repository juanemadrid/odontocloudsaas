// src/services/billingService.js
import supabase from "../lib/supabaseClient";
import { getConfigSectionCached } from "./configCacheService";

const s = (n) => Number(n || 0);

export const getPatientFinancials = async (patientId, tenantId) => {
    if (!patientId) return { facturas: [], pagos: [], plans: [], totals: {} };

    try {
        let pagos = [];
        let facturas = [];
        let plans = [];

        // 1. Load Pagos — solo columnas que existen en el schema de Supabase
        const PAGO_COLS = "id, paciente_id, tenant_id, monto, fecha, created_at, metodo, referencia, notas, estado";
        
        try {
            const { data, error } = await supabase
                .from("pagos")
                .select(PAGO_COLS)
                .eq("paciente_id", patientId)
                .order("created_at", { ascending: false });
            
            if (!error && data && data.length > 0) {
                pagos = data;
            }
        } catch (e) {}

        // Fallback 1: filtrar por tenant en servidor (no en JS)
        if (pagos.length === 0 && tenantId) {
            try {
                const { data: tenantPagos } = await supabase
                    .from("pagos")
                    .select(PAGO_COLS)
                    .eq("tenant_id", tenantId)
                    .eq("paciente_id", patientId);
                
                if (tenantPagos && tenantPagos.length > 0) {
                    pagos = tenantPagos;
                }
            } catch (e) {}
        }

        // Fallback 2: website_config — usando caché compartida
        if (pagos.length === 0 && tenantId) {
            try {
                const cfgPagos = await getConfigSectionCached(tenantId, "pagos", []);
                pagos = cfgPagos.filter(p => 
                    p.paciente_id === patientId || 
                    p.pacienteId === patientId || 
                    p.patient_id === patientId || 
                    p.patientId === patientId
                );
            } catch (e) {}
        }

        // 2. Load Facturas — columnas necesarias
        try {
            const { data } = await supabase
                .from("facturas")
                .select("id, paciente_id, total, estado, fecha_emision, created_at")
                .eq("paciente_id", patientId);
            if (data) facturas = data;
        } catch (e) {}

        // 3. Load Treatment Plans — columnas necesarias
        try {
            const { data } = await supabase
                .from("treatment_plans")
                .select("id, paciente_id, total, estado")
                .eq("paciente_id", patientId);
            if (data) plans = data;
        } catch (e) {}

        // Format facturas
        facturas = (facturas || []).map(f => ({
            id: f.id,
            ...f,
            total: s(f.total),
            estado: (f.estado || "pendiente").toLowerCase(),
            fechaISO: f.fecha_emision || f.created_at
        })).sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || ""));

        // Format pagos — los campos extra se leen desde notas (guardados como JSON)
        pagos = (pagos || []).map(p => {
            // Intentar parsear notas como JSON para extraer campos extra
            let notasParsed = {};
            try {
                if (p.notas && p.notas.startsWith("{")) {
                    notasParsed = JSON.parse(p.notas);
                }
            } catch (e) {}

            const isVoided = (p.estado || "").toLowerCase() === "anulado" ||
                             (p.referencia || "").toUpperCase().includes("ANULADO") ||
                             (p.notas || "").toUpperCase().includes("ANULADO");

            let motivo = notasParsed.motivoAnulacion || p.motivo_anulacion || "";
            if (!motivo && isVoided && p.notas && !p.notas.startsWith("{")) {
                motivo = p.notas.replace(/^ANULADO\s*-\s*/i, "").trim();
            }

            let rawConcepto = notasParsed.concepto || p.concepto || p.referencia || "ABONO GENERAL";
            if (notasParsed.planTitle && !rawConcepto.toLowerCase().includes(notasParsed.planTitle.toLowerCase())) {
                rawConcepto = `${rawConcepto} (${notasParsed.planTitle})`;
            }

            const validUser = notasParsed.registradoPor || notasParsed.usuarioNombre || p.registrado_por || p.usuario_nombre || p.creado_por || "";

            return {
                id: p.id,
                ...p,
                monto: s(p.monto),
                fechaISO: p.fecha || p.created_at,
                medio: p.metodo || p.medio || "—",
                concepto: rawConcepto,
                referencia: notasParsed.referencia || p.referencia || "",
                estado: isVoided ? "Anulado" : (p.estado || "Completado"),
                motivoAnulacion: motivo,
                notas: notasParsed.notas || notasParsed.observaciones || (p.notas && !p.notas.startsWith("{") ? p.notas : "") || "",
                notes: notasParsed.notas || notasParsed.observaciones || "",
                nroConsecutivo: notasParsed.nroConsecutivo || "",
                consecutivo: notasParsed.nroConsecutivo || "",
                registradoPor: validUser,
                usuarioNombre: validUser
            };
        }).sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || ""));

        // Format plans
        plans = (plans || []).map(p => ({
            id: p.id,
            ...p,
            costoTotal: s(p.total),
            pagado: 0
        }));

        const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''));
        const facturaIds = facturas.map(f => f.id).filter(isValidUUID);
        let notasDebito = [];

        if (facturaIds.length > 0) {
            try {
                const { data, error: ndErr } = await supabase
                    .from("notas_debito")
                    .select("id,factura_id,monto,motivo,fecha,numero")
                    .in("factura_id", facturaIds);
                if (!ndErr && data) notasDebito = data;
            } catch (e) {}
        }

        // Leer saldo_favor del paciente de forma segura
        let patientSaldoFavor = 0;
        try {
            const { data: pacData } = await supabase
                .from("pacientes")
                .select("saldo_favor")
                .eq("id", patientId)
                .maybeSingle();
            if (pacData) {
                patientSaldoFavor = Number(pacData.saldo_favor || 0);
            }
        } catch (e) {
            // ignorar
        }

        const isNotAnulado = (p) => {
            const estadoStr = (p.estado || "").toLowerCase();
            const refStr = (p.referencia || "").toUpperCase();
            const notesStr = (p.notas || p.notes || "").toUpperCase();
            return estadoStr !== "anulado" && !refStr.includes("ANULADO") && !notesStr.includes("ANULADO");
        };

        const isCreditTopUp = (p) => {
            const ref = (p.referencia || p.concepto || "").toUpperCase();
            const notes = (p.notas || p.notes || "").toUpperCase();
            const method = (p.metodo || p.medio || "").toLowerCase();
            return method !== "saldo a favor" && (ref === "SALDO A FAVOR" || notes.includes("SALDO A FAVOR")) && isNotAnulado(p);
        };

        const isCreditUsed = (p) => {
            const m = (p.metodo || p.medio || "").toLowerCase();
            return m === "saldo a favor" && isNotAnulado(p);
        };

        const totalDebito = notasDebito
            .filter(n => isNotAnulado(n))
            .reduce((acc, n) => acc + s(n.monto), 0);

        const totalFacturado = facturas.reduce((acc, f) => acc + f.total, 0) + totalDebito;
        const totalPagado = pagos
            .filter(p => !isCreditUsed(p) && isNotAnulado(p))
            .reduce((acc, p) => acc + p.monto, 0);

        const totalCredits = pagos
            .filter(p => isCreditTopUp(p))
            .reduce((acc, p) => acc + p.monto, 0);

        const usedCredits = pagos
            .filter(p => isCreditUsed(p))
            .reduce((acc, p) => acc + p.monto, 0);

        const totalSaldosAFavor = Math.max(0, Math.max(patientSaldoFavor, totalCredits) - usedCredits);
        const totalAbonosTratamiento = pagos
            .filter(p => !isCreditTopUp(p) && !isCreditUsed(p) && isNotAnulado(p))
            .reduce((acc, p) => acc + p.monto, 0);

        const facturasPagadas = facturas.filter((f) => ["pagada", "pagado", "paid"].includes(f.estado));
        const facturasPendientes = facturas.filter((f) => ["pendiente", "abierta", "open", "deuda"].includes(f.estado));

        const totalFacturasPagadas = facturasPagadas.reduce((acc, f) => acc + f.total, 0);
        const totalFacturasPendientes = facturasPendientes.reduce((acc, f) => acc + f.total, 0);

        const rawBalance = totalFacturado - totalPagado;
        const balance = rawBalance > 0 ? rawBalance : 0;

        return {
            facturas,
            pagos,
            plans,
            totals: {
                totalFacturado,
                totalPagado,
                totalAbonosTratamiento,
                totalFacturasPendientes,
                totalFacturasPagadas,
                totalSaldosAFavor,
                balance,
                rawBalance
            }
        };
    } catch (error) {
        console.error("Error al obtener estado financiero en Supabase:", error);
        return { facturas: [], pagos: [], plans: [], totals: {} };
    }
};


