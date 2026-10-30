import supabase from "../lib/supabaseClient.js";
import { getFevRetryDecision } from "./factusRetryService.js";
import { fiscalInvoiceNumber, isDiscardedInvoice } from "../utils/invoiceNumbering.js";

// Solo se descarta un intento que Factus rechazó ANTES de crear el documento:
// no tiene número fiscal ni CUFE y no existe en Factus. Nunca se borra la fila;
// queda como registro de auditoría, fuera de cartera y sin poder reenviarse.
const SAFE_REASONS = new Set([
  "FACTUS_VALIDATION_FAILED",
  "LOCAL_PREFLIGHT_FAILED",
  "VERIFIED_DOCUMENT_REQUIRES_REVIEW",
]);

const linkedReceipts = (d) => {
  if (Array.isArray(d.recibos_asociados) && d.recibos_asociados.length) return d.recibos_asociados;
  return d.recibo_asociado ? [d.recibo_asociado] : [];
};

export const discardBlockReason = (invoice) => {
  if (!invoice) return "No se encontró la factura.";
  const d = invoice.detalles && typeof invoice.detalles === "object" ? invoice.detalles : {};
  if (isDiscardedInvoice(invoice)) return "Este intento ya fue descartado.";
  if (fiscalInvoiceNumber(invoice) || d.cufe || d.factusCufe || invoice.factusCufe) {
    return "La factura tiene número fiscal de la DIAN. Para anularla se debe emitir una Nota Crédito.";
  }
  if (d.factusExists === true || d.pending409 === true || d.technicalError === true) {
    return "Factus todavía tiene registrado este documento. Primero use \"Verificar estado\".";
  }
  if (linkedReceipts(d).length || Number(d.monto_pagado || 0) > 0) {
    return "La factura tiene recibos de caja asociados. Corrija y reenvíe esta factura en lugar de descartarla.";
  }
  const decision = getFevRetryDecision(invoice);
  if (!SAFE_REASONS.has(decision.reason)) {
    return "Solo se pueden descartar intentos rechazados por Factus que nunca llegaron a la DIAN.";
  }
  return null;
};

export const canDiscardInvoice = (invoice) => discardBlockReason(invoice) === null;

export async function discardRejectedInvoice({ invoiceId, tenantId, reason, userProfile = {}, client = supabase }) {
  const motivo = String(reason || "").trim();
  if (!invoiceId || !tenantId) throw new Error("Faltan datos de la factura.");
  if (motivo.length < 5) throw new Error("Escriba el motivo del descarte (mínimo 5 caracteres).");

  const { data: current, error: readError } = await client.from("facturas")
    .select("*").eq("id", invoiceId).eq("tenant_id", tenantId).single();
  if (readError || !current) throw new Error("No se pudo leer la factura. No se descartó.");

  const blocked = discardBlockReason(current);
  if (blocked) throw new Error(blocked);

  const d = current.detalles && typeof current.detalles === "object" ? current.detalles : {};
  const usuario = userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email || "Usuario";
  const detalles = {
    ...d,
    descartada: true,
    descarte: {
      fecha: new Date().toISOString(),
      usuario,
      usuario_id: userProfile?.uid || userProfile?.id || null,
      motivo,
      estado_anterior: current.estado || null,
      dian_status_anterior: d.dianStatus || null,
      saldo_anterior: d.saldo_pendiente ?? null,
    },
    dianStatus: "DESCARTADA",
    saldo_pendiente: 0,
    estado_pago: "DESCARTADA",
  };

  // Compare-and-set: si otra sesión cambió la factura (p. ej. la está reenviando), no se toca.
  const { data: saved, error } = await client.from("facturas")
    .update({ estado: "Cancelado", detalles })
    .eq("id", invoiceId).eq("tenant_id", tenantId)
    .eq("detalles", JSON.stringify(current.detalles))
    .select("id").single();
  if (error || !saved) {
    throw new Error("Otra sesión modificó la factura mientras se descartaba. Actualice la lista e intente de nuevo.");
  }
  return saved;
}
