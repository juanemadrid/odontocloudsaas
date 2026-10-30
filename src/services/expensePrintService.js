// Comprobante de egreso: un solo armado para imprimir desde "Egresos" y desde "Facturas de compra".
// Antes cada módulo armaba los datos a su manera: uno perdía el documento y el celular del
// beneficiario y el otro imprimía el concepto como UNDEFINED y los valores como $NaN.
import supabase from "../lib/supabaseClient.js";
import { queryOptionalBillingTable } from "./optionalBillingTables.js";
import { expenseMatchesInvoice, getExpenseNumber } from "./supplierExpenseLinks.js";

const text = (value) => (value == null ? "" : String(value).trim());
const digits = (value) => text(value).replace(/\D/g, "");
const sameName = (value) => text(value).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").toUpperCase();
const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const formatEgresoConcepto = (concepto, pago) => {
  if (!concepto) return "Egreso / Pago";
  const s = String(concepto).trim();
  if (pago?.liquidacionId || /^liquidaci[oó]n\s+(de\s+)?comisiones/i.test(s)) return "Liquidación comisiones";
  return s;
};

// "Generado automáticamente desde módulo de Liquidaciones. Liquidación ID: liq_123" → sin el ID interno.
export const cleanExpenseObservation = (value) =>
  text(value).replace(/\s*Liquidaci[oó]n ID:\s*[^\s,;]+\.?/gi, "").replace(/\s{2,}/g, " ").trim();

const beneficiaryName = (pago, fallbackFactura) =>
  text(pago?.tercero || pago?.proveedor || pago?.profesional || fallbackFactura?.proveedor || fallbackFactura?.tercero);

const beneficiaryFromRecord = (record = {}) => ({
  nombre: text(record.nombre || record.razonSocial || record.razon_social || record.proveedor || record.tercero
    || [record.nombres, record.apellidos].filter(Boolean).join(" ")),
  documento: text(record.documentoTercero || record.nroDocumento || record.nro_documento || record.numero_documento
    || record.documento || record.nit || record.cedula),
  tipoDocumento: text(record.tipoDocumento || record.tipo_documento || record.tipoDocumentoTercero),
  telefono: text(record.telefono || record.celular || record.movil || record.telefonoTercero),
  direccion: text(record.direccion || record.direccionProveedor),
  ciudad: text(record.ciudad || record.ciudadProveedor || record.municipio),
});

// Busca el beneficiario por documento o, si no hay, por nombre exacto (sin tildes/mayúsculas).
// Si el nombre corresponde a personas con documentos distintos, no adivina.
export function matchBeneficiary(pago, fallbackFactura, candidates = []) {
  const f = fallbackFactura || {};
  const own = {
    nombre: beneficiaryName(pago, fallbackFactura),
    documento: text(pago?.documentoTercero || pago?.nit || pago?.cedula || f.documentoTercero || f.nit),
    tipoDocumento: text(pago?.tipoDocumentoTercero || f.tipoDocumentoTercero),
    telefono: text(pago?.telefono || f.telefono),
    direccion: text(pago?.direccion || f.direccion || f.direccionProveedor),
    ciudad: text(pago?.ciudad || f.ciudad || f.ciudadProveedor),
  };
  const people = candidates.map((c) => (c && c.__compra ? c : beneficiaryFromRecord(c))).filter((c) => c.nombre || c.documento);
  let matches = [];
  if (digits(own.documento)) matches = people.filter((c) => digits(c.documento) && digits(c.documento) === digits(own.documento));
  if (!matches.length && own.nombre) matches = people.filter((c) => sameName(c.nombre) === sameName(own.nombre));
  const docs = new Set(matches.map((c) => digits(c.documento)).filter(Boolean));
  const found = docs.size > 1 ? {} : matches.reduce((acc, c) => ({
    documento: acc.documento || c.documento, tipoDocumento: acc.tipoDocumento || c.tipoDocumento,
    telefono: acc.telefono || c.telefono, direccion: acc.direccion || c.direccion, ciudad: acc.ciudad || c.ciudad,
  }), {});
  return {
    nombre: own.nombre || "BENEFICIARIO / TERCERO",
    documento: own.documento || found.documento || "",
    tipoDocumento: own.tipoDocumento || found.tipoDocumento || "",
    telefono: own.telefono || found.telefono || "",
    direccion: own.direccion || found.direccion || "",
    ciudad: own.ciudad || found.ciudad || "",
  };
}

const isPurchaseItem = (it) => it?.isFactura || it?.facturaId || /^FC[A-Z0-9\-_]*/i.test(it?.concepto || "") || /^DS[A-Z0-9\-_]*/i.test(it?.concepto || "");

export function buildExpensePrint({ pago = {}, fallbackFactura = null, beneficiary, facturasMap = {}, userProfile = {} }) {
  const who = beneficiary || matchBeneficiary(pago, fallbackFactura, []);
  const isNit = (who.tipoDocumento || "").toUpperCase() === "NIT" || digits(who.documento).length >= 9;
  const patientPayload = {
    nombreCompleto: who.nombre,
    documento: who.documento || "—",
    tipoDocumento: who.tipoDocumento || (isNit ? "NIT" : "CC"),
    direccion: who.direccion || "—",
    ciudad: who.ciudad || userProfile?.tenantCiudad || "Sincelejo",
    celular: who.telefono || "—",
  };

  const numDocFac = text(fallbackFactura?.nroFactura || fallbackFactura?.documentoNumero);
  const montoTotal = money(pago.monto ?? pago.total ?? fallbackFactura?.totalNeto ?? fallbackFactura?.total);
  const facturaRefs = [];
  const sourceItems = Array.isArray(pago.items) ? pago.items : [];
  let itemPayments = sourceItems.map((it) => {
    let desc;
    if (isPurchaseItem(it)) {
      const fc = facturasMap[it.facturaId] || facturasMap[it.concepto] || facturasMap[it.numeroFactura] || null;
      const numDoc = fc?.nroFactura || fc?.documentoNumero || it.numeroFactura || it.concepto;
      if (numDoc) facturaRefs.push(numDoc);
      if (fc && Array.isArray(fc.items) && fc.items.length) {
        desc = fc.items.map((i) => (i.concepto && i.descripcion && i.concepto !== i.descripcion ? `${i.concepto} - ${i.descripcion}` : (i.concepto || i.descripcion))).filter(Boolean).join(", ");
      } else if (fc?.concepto || fc?.descripcion) {
        desc = fc.concepto || fc.descripcion;
      } else if (it.descripcion && !sameName(it.descripcion).includes(sameName(who.nombre))) {
        desc = it.descripcion;
      } else {
        desc = "ADQUISICIÓN DE BIENES / SERVICIOS";
      }
    } else {
      desc = it.concepto && it.descripcion && it.concepto !== it.descripcion ? `${it.concepto} - ${it.descripcion}` : (it.concepto || it.descripcion || it.desc || "Item");
    }
    const cantidad = money(it.cantidad) || 1;
    const unit = money(it.precioUnitario ?? it.precio ?? it.valor);
    const total = it.total != null ? money(it.total) : (it.monto != null ? money(it.monto) : unit * cantidad);
    return { desc: formatEgresoConcepto(desc, pago), monto: total, precioUnitario: unit || total / cantidad, cantidad };
  });
  if (!itemPayments.length) {
    const desc = numDocFac ? `Pago Factura / Documento Soporte: ${numDocFac}` : formatEgresoConcepto(pago.concepto || "Pago a proveedor", pago);
    itemPayments = [{ desc, monto: montoTotal, precioUnitario: montoTotal, cantidad: 1 }];
  }

  let obs = cleanExpenseObservation(pago.observaciones).replace(/factura de compra\s*\/\s*documento soporte:\s*/gi, "").trim();
  if (/^egreso caja menor:\s*/i.test(obs)) {
    const content = obs.replace(/^egreso caja menor:\s*/i, "").trim().toLowerCase();
    if (!content || itemPayments.some((it) => it.desc.toLowerCase().includes(content))) obs = "";
  }
  const refs = [...new Set(facturaRefs)].join(", ");
  if (refs) obs = !obs ? refs : (obs.includes(refs) ? obs : `${refs} — ${obs}`);
  if (!obs && numDocFac) obs = `Pago asociado a documento ${numDocFac}`;

  const isAnulado = pago.anulado || text(pago.estado).toLowerCase() === "anulado";
  const motivo = text(pago.motivo_anulacion || pago.motivoAnulacion);
  const pagoPayload = {
    ...pago,
    tipo: "egreso",
    tipoDocumento: "Egreso",
    documentTitle: isAnulado ? "COMPROBANTE DE EGRESO (ANULADO)" : "COMPROBANTE DE EGRESO",
    monto: montoTotal,
    total: montoTotal,
    concepto: formatEgresoConcepto(itemPayments[0]?.desc || pago.concepto || "Egreso / Pago a proveedor", pago),
    nroConsecutivo: getExpenseNumber(pago) || "S/N",
    medio: pago.medioPago || pago.medio || pago.bancoCaja || fallbackFactura?.medioPago || "Efectivo",
    registradoPor: pago.registradoPor || pago.registrado_por || pago.usuarioCreador || pago.usuario_nombre || pago.usuarioNombre
      || pago.creadoPor || pago.creado_por || pago.created_by || pago.cajero || pago.usuario || userProfile?.nombreCompleto || "Administración",
    itemPayments,
    observaciones: isAnulado ? `*** DOCUMENTO ANULADO: ${motivo || "Anulado por administración"} ***${obs ? ` — ${obs}` : ""}` : obs,
    telefono: who.telefono || pago.telefono,
  };
  return { pagoPayload, patientPayload };
}

async function loadSources(tenantId, client) {
  const [purchases, config, sqlThirds] = await Promise.all([
    client.from("facturas_compra").select("*").eq("tenant_id", tenantId).then((r) => r.data || [], () => []),
    client.from("website_config").select("config").eq("tenant_id", tenantId).maybeSingle().then((r) => r.data?.config || {}, () => ({})),
    queryOptionalBillingTable("terceros", (t) => t.select("*").eq("tenant_id", tenantId)).then((r) => r?.data || [], () => []),
  ]);
  const allPurchases = purchases.length ? purchases : (config.facturas_compra || []);
  const facturasMap = {};
  for (const f of allPurchases) {
    for (const key of [f.id, f.nroFactura, f.documentoNumero]) if (key) facturasMap[key] = f;
  }
  const thirds = [...sqlThirds, ...(config.terceros || []), ...(config.proveedores || [])];
  // De una factura de compra solo se toman los datos del proveedor (no su número de documento).
  const fromPurchases = allPurchases.map((f) => ({ __compra: true,
    nombre: text(f.proveedor || f.tercero), documento: text(f.documentoTercero || f.nitProveedor),
    tipoDocumento: text(f.tipoDocumentoTercero), telefono: text(f.telefono), direccion: text(f.direccion || f.direccionProveedor),
    ciudad: text(f.ciudad || f.ciudadProveedor) }));
  return { facturasMap, candidates: [...thirds, ...fromPurchases], purchases: allPurchases };
}

// Arma el comprobante completo: busca el documento y celular del beneficiario si el egreso no los trae.
export async function prepareExpensePrint({ tenantId, pago, fallbackFactura = null, userProfile = {}, client = supabase, sources = null }) {
  const { facturasMap, candidates, purchases = [] } = sources || await loadSources(tenantId, client);
  // Desde "Egresos" se usa el mismo documento soporte asociado que muestra "Facturas de compra",
  // para que las dos impresiones salgan iguales.
  const linked = fallbackFactura || purchases.find((f) => expenseMatchesInvoice(pago, f)) || null;
  const beneficiary = matchBeneficiary(pago, linked, candidates);
  return buildExpensePrint({ pago, fallbackFactura: linked, beneficiary, facturasMap, userProfile });
}
