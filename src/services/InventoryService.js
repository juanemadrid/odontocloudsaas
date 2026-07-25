// src/services/InventoryService.js
import supabase from "../lib/supabaseClient";
import { getRecetaForTratamiento } from "../api/recetasCatalog";

/**
 * Descuenta del inventario los insumos asociados a una lista de servicios facturados en Supabase.
 * @param {Array} itemsFactura Array de items { desc: "Resina", qty: 1, ... }
 */
export const processInventoryDeduction = async (itemsFactura, tenantId) => {
    if (!itemsFactura || itemsFactura.length === 0 || !tenantId) return;

    try {
        console.log("📦 Iniciando descuento de inventario automático en Supabase...");

        const insumosRequeridos = {};

        itemsFactura.forEach(item => {
            let tratamientoKey = 'consulta';
            const d = (item.desc || "").toLowerCase();

            if (d.includes('resina') || d.includes('calza')) tratamientoKey = 'caries';
            else if (d.includes('endo') || d.includes('conducto')) tratamientoKey = 'endodoncia';
            else if (d.includes('extrac') || d.includes('sacar')) tratamientoKey = 'extraccion';
            else if (d.includes('limpieza') || d.includes('higiene')) tratamientoKey = 'limpieza';

            const receta = getRecetaForTratamiento(tratamientoKey);

            receta.forEach(insumo => {
                if (!insumosRequeridos[insumo.productoId]) {
                    insumosRequeridos[insumo.productoId] = 0;
                }
                insumosRequeridos[insumo.productoId] += (insumo.cantidad * (item.qty || 1));
            });
        });

        const productCodes = Object.keys(insumosRequeridos);

        for (const codigo of productCodes) {
            const { data: items } = await supabase
                .from("inventario")
                .select("id, cantidad")
                .eq("tenant_id", tenantId)
                .eq("codigo", codigo);

            if (items && items.length > 0) {
                for (const invItem of items) {
                    const currentStock = Number(invItem.cantidad || 0);
                    const deduction = insumosRequeridos[codigo];
                    const newStock = Math.max(0, currentStock - deduction);

                    await supabase
                        .from("inventario")
                        .update({ cantidad: newStock })
                        .eq("id", invItem.id);
                }
            }
        }

        console.log("✅ Inventario actualizado correctamente en Supabase.");
        return true;

    } catch (error) {
        console.error("❌ Error actualizando inventario en Supabase:", error);
        return false;
    }
};
