// src/services/billingService.js
import supabase from "../lib/supabaseClient";

const s = (n) => Number(n || 0);

export const getPatientFinancials = async (patientId) => {
    if (!patientId) return { facturas: [], pagos: [], totals: {} };

    try {
        const [resF, resP, resPlans, resND] = await Promise.all([
            supabase.from("facturas").select("*").eq("paciente_id", patientId),
            supabase.from("pagos").select("*").eq("paciente_id", patientId),
            supabase.from("treatment_plans").select("*").eq("paciente_id", patientId),
            supabase.from("notas_debito").select("*").eq("paciente_id", patientId)
        ]);

        const facturas = (resF.data || []).map(f => ({
            id: f.id,
            ...f,
            total: s(f.total),
            estado: (f.estado || "pendiente").toLowerCase(),
            fechaISO: f.fecha_emision || f.created_at
        })).sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || ""));

        const pagos = (resP.data || []).map(p => ({
            id: p.id,
            ...p,
            monto: s(p.monto),
            fechaISO: p.fecha || p.created_at,
            medio: p.metodo || "—"
        })).sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || ""));

        const plans = (resPlans.data || []).map(p => ({
            id: p.id,
            ...p,
            costoTotal: s(p.total),
            pagado: 0
        }));

        const totalDebito = (resND.data || [])
            .filter(n => n.estado !== "Anulado")
            .reduce((acc, n) => acc + s(n.monto), 0);

        const totalFacturado = facturas.reduce((acc, f) => acc + f.total, 0) + totalDebito;
        const totalPagado = pagos
            .filter(p => (p.medio || "").toLowerCase() !== "saldo a favor" && p.estado !== "Anulado")
            .reduce((acc, p) => acc + p.monto, 0);

        const totalCredits = pagos
            .filter(p => p.concepto === "SALDO A FAVOR" && p.estado !== "Anulado")
            .reduce((acc, p) => acc + p.monto, 0);

        const usedCredits = pagos
            .filter(p => (p.medio || "").toLowerCase() === "saldo a favor" && p.estado !== "Anulado")
            .reduce((acc, p) => acc + p.monto, 0);

        const totalSaldosAFavor = Math.max(0, totalCredits - usedCredits);
        const totalAbonosTratamiento = pagos
            .filter(p => p.concepto !== "SALDO A FAVOR" && p.estado !== "Anulado")
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
