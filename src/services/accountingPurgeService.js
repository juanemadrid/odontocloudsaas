// src/services/accountingPurgeService.js
/**
 * accountingPurgeService.js
 * Servicio administrativo seguro para reiniciar exclusivamente los datos contables de prueba
 * de una clínica (recibos de caja, pagos, egresos, movimientos de caja, saldos a favor y contadores).
 * 
 * NO elimina historias clínicas, pacientes, odontogramas ni configuraciones institucionales.
 */

import supabase from "../lib/supabaseClient";
import { getConfigItems, saveConfigItem } from "./configPersistenceService";

export const purgeTestAccountingData = async (tenantId) => {
    if (!tenantId) throw new Error("ID de clínica no especificado");

    console.log(`[accountingPurgeService] Iniciando purga segura de datos contables para tenant: ${tenantId}`);

    // 1. Eliminar recibos de caja en PostgreSQL
    try {
        const { error } = await supabase
            .from("recibos_caja")
            .delete()
            .eq("tenant_id", tenantId);
        if (error) console.warn("Aviso eliminando recibos_caja:", error.message);
    } catch (e) {
        console.warn("Excepción eliminando recibos_caja:", e);
    }

    // 2. Eliminar pagos (abonos e historial de pagos de pacientes)
    try {
        const { error } = await supabase
            .from("pagos")
            .delete()
            .eq("tenant_id", tenantId);
        if (error) console.warn("Aviso eliminando pagos:", error.message);
    } catch (e) {
        console.warn("Excepción eliminando pagos:", e);
    }

    // 3. Eliminar pagos a proveedores si existe la tabla
    try {
        await supabase
            .from("pagos_proveedor")
            .delete()
            .eq("tenant_id", tenantId);
    } catch (e) {}

    // 4. Eliminar movimientos de caja (apuntes de mostrador de caja chica)
    try {
        const { error } = await supabase
            .from("movimientos_caja")
            .delete()
            .eq("tenant_id", tenantId);
        if (error) console.warn("Aviso eliminando movimientos_caja:", error.message);
    } catch (e) {
        console.warn("Excepción eliminando movimientos_caja:", e);
    }

    // 5. Resetear saldos a favor en la tabla pacientes a 0
    try {
        await supabase
            .from("pacientes")
            .update({
                saldo_favor: 0,
                saldoFavor: 0,
                updated_at: new Date().toISOString()
            })
            .eq("tenant_id", tenantId);
    } catch (e) {
        console.warn("Aviso reseteando saldo_favor en pacientes:", e);
    }

    // 6. Resetear cajas abiertas / saldos (dejar saldo_actual = base_inicial, ingresos = 0, egresos = 0)
    try {
        const { data: cajas } = await supabase
            .from("cajas")
            .select("id, base_inicial, baseInicial")
            .eq("tenant_id", tenantId);

        if (cajas && cajas.length > 0) {
            for (const c of cajas) {
                const base = Number(c.base_inicial ?? c.baseInicial ?? 0);
                await supabase
                    .from("cajas")
                    .update({
                        saldo_actual: base,
                        saldoActual: base,
                        total_ingresos: 0,
                        totalIngresos: 0,
                        total_egresos: 0,
                        totalEgresos: 0,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", c.id);
            }
        }
    } catch (e) {
        console.warn("Aviso reseteando cajas:", e);
    }

    // 7. Limpiar en website_config (recibos_caja, pagos_proveedor, pagos, saldos_favor)
    try {
        const { data: cfgRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", tenantId)
            .maybeSingle();

        if (cfgRow?.config) {
            const nextCfg = {
                ...cfgRow.config,
                recibos_caja: [],
                pagos_proveedor: [],
                pagos: [],
                saldos_favor: []
            };
            await supabase
                .from("website_config")
                .upsert({ tenant_id: tenantId, config: nextCfg });
        }
    } catch (e) {
        console.warn("Aviso limpiando website_config:", e);
    }

    // 8. Reiniciar contadores de consecutivos oficiales a 0 (el próximo asignado será 1)
    try {
        const consList = await getConfigItems(tenantId, "consecutivos", "consecutivos");
        if (Array.isArray(consList) && consList.length > 0) {
            for (const c of consList) {
                await saveConfigItem(tenantId, "consecutivos", "consecutivos", {
                    ...c,
                    contReciboCaja: 0,
                    contEgresos: 0,
                    contUsoSaldoFavor: 0,
                    contUsoNotasCredito: 0,
                    updated_at: new Date().toISOString()
                });
            }
        }
    } catch (e) {
        console.warn("Aviso reiniciando consecutivos:", e);
    }

    // 9. Limpiar cachés de sessionStorage y localStorage
    try {
        Object.keys(sessionStorage).forEach(k => {
            if (k.includes("recibo") || k.includes("pago") || k.includes("consecutivo") || k.includes("config") || k.includes("saldo")) {
                sessionStorage.removeItem(k);
            }
        });
        Object.keys(localStorage).forEach(k => {
            if (k.includes("recibo") || k.includes("pago") || k.includes("consecutivo") || k.includes("saldo")) {
                localStorage.removeItem(k);
            }
        });
    } catch (e) {}

    console.log(`[accountingPurgeService] Purga contable completada exitosamente.`);
    return true;
};
