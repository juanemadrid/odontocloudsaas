/**
 * ¿Dos registros (factura de compra, documento soporte, egreso…) son del mismo tercero?
 * Compara, en este orden: el id del tercero, el documento (NIT/cédula, sin el dígito de verificación)
 * y el nombre o razón social normalizado. Misma lógica que usa "Añadir factura" en Egresos.
 */
const str = (v) => (v === null || v === undefined ? "" : String(v).trim());

export function terceroNombre(r) {
  if (!r) return "";
  for (const k of ["proveedor", "tercero", "proveedorNombre", "terceroNombre", "nombre", "paciente", "pacienteNombre"]) {
    if (typeof r[k] === "string" && r[k].trim()) return r[k].trim();
  }
  for (const k of ["tercero", "proveedor", "paciente", "terceroObj"]) {
    const o = r[k];
    if (o && typeof o === "object") {
      const n = o.nombre || o.razonSocial || o.razon_social || o.nombre_completo || o.nombreCompleto || o.nombres;
      if (n) return String(n).trim();
    }
  }
  return "";
}

export function terceroDocumento(r) {
  if (!r) return "";
  for (const k of ["documentoTercero", "terceroDoc", "proveedorDoc", "nit", "nroDocumento", "documento", "documentoPaciente"]) {
    if (typeof r[k] === "string" || typeof r[k] === "number") { const v = str(r[k]); if (v) return v; }
  }
  for (const k of ["terceroObj", "tercero", "proveedor"]) {
    const o = r[k];
    if (o && typeof o === "object") {
      const d = o.documento || o.numero_documento || o.nroDocumento || o.nit || o.identificacion;
      if (d) return str(d);
    }
  }
  return "";
}

export function terceroId(r) {
  if (!r) return "";
  return str(r.terceroId || r.tercero_id || r.proveedorId || r.proveedor_id || r.pacienteId || r.paciente_id
    || (r.terceroObj && r.terceroObj.id) || (r.tercero && typeof r.tercero === "object" && r.tercero.id)
    || (r.proveedor && typeof r.proveedor === "object" && r.proveedor.id));
}

const normalizar = (v) => str(v).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const sinSociedad = (v) => normalizar(v)
  .replace(/\b(s ?a ?s|s ?a|ltda|limitada|e ?u|eps|ips|sociedad|cia|y cia|s en c|e s p)\b/g, " ")
  .replace(/\s+/g, " ").trim();
const digitos = (v) => {
  const s = str(v);
  const base = s.includes("-") ? s.split("-")[0] : s;
  return { full: s.replace(/\D/g, ""), base: base.replace(/\D/g, "") };
};

export function mismoTercero(a, b) {
  if (!a || !b) return false;
  const idA = terceroId(a), idB = terceroId(b);
  if (idA && idB && idA === idB) return true;

  const dA = digitos(terceroDocumento(a)), dB = digitos(terceroDocumento(b));
  if (dA.base.length >= 4 && dB.base.length >= 4 && dA.base === dB.base) return true;
  if (dA.full.length >= 4 && dB.full.length >= 4 && dA.full === dB.full) return true;

  const nA = terceroNombre(a), nB = terceroNombre(b);
  if (nA && nB) {
    if (normalizar(nA) === normalizar(nB)) return true;
    const cA = sinSociedad(nA), cB = sinSociedad(nB);
    if (cA.length >= 4 && cB.length >= 4 && cA === cB) return true;
  }
  return false;
}
