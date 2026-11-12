/**
 * ¿Dos registros (factura de compra, documento soporte, egreso…) son del mismo tercero?
 * Compara, en este orden: el id del tercero, el documento (NIT/cédula, sin el dígito de verificación)
 * y el nombre o razón social normalizado estrictamente (sin tildes ni sufijos societarios).
 */
const str = (v) => (v === null || v === undefined ? "" : String(v).trim());

export function terceroNombre(r) {
  if (!r) return "";
  const ap = String(r.apellidos || r.apellido || "").trim();
  for (const k of ["proveedor", "tercero", "proveedorNombre", "terceroNombre", "nombre", "paciente", "pacienteNombre", "profesional", "profesionalNombre", "doctor", "doctorNombre"]) {
    if (typeof r[k] === "string" && r[k].trim()) {
      const nom = r[k].trim();
      if (ap && !nom.toLowerCase().includes(ap.toLowerCase())) {
        return `${nom} ${ap}`.trim();
      }
      return nom;
    }
  }
  for (const k of ["tercero", "proveedor", "paciente", "terceroObj", "profesionalObj", "doctorObj"]) {
    const o = r[k];
    if (o && typeof o === "object") {
      const oAp = String(o.apellidos || o.apellido || ap || "").trim();
      const n = (o.apellidos || o.apellido)
        ? [o.nombre, o.apellidos || o.apellido].filter(Boolean).join(" ").trim()
        : (o.razonSocial || o.razon_social || o.nombre_completo || o.nombreCompleto || o.nombre || o.nombres);
      if (n) {
        const nom = String(n).trim();
        if (oAp && !nom.toLowerCase().includes(oAp.toLowerCase())) {
          return `${nom} ${oAp}`.trim();
        }
        return nom;
      }
    }
  }
  return "";
}

export function terceroDocumento(r) {
  if (!r) return "";
  for (const k of [
    "documentoTercero", "terceroDoc", "proveedorDoc", "nit", "nroDocumento",
    "documento", "documentoPaciente", "cedula", "identificacion",
    "documentoProfesional", "docProfesional"
  ]) {
    if (typeof r[k] === "string" || typeof r[k] === "number") {
      const v = str(r[k]);
      if (v) return v;
    }
  }
  for (const k of ["terceroObj", "tercero", "proveedor", "profesionalObj", "doctorObj"]) {
    const o = r[k];
    if (o && typeof o === "object") {
      const d = o.documento || o.numero_documento || o.nroDocumento || o.nit || o.identificacion || o.cedula;
      if (d) return str(d);
    }
  }
  return "";
}

export function terceroId(r) {
  if (!r) return "";
  const direct = r.terceroId || r.tercero_id || r.proveedorId || r.proveedor_id
    || r.pacienteId || r.paciente_id || r.profesionalId || r.profesional_id
    || r.doctorId || r.doctor_id;
  if (direct) return str(direct);

  if (r.terceroObj && typeof r.terceroObj === "object" && r.terceroObj.id) return str(r.terceroObj.id);
  if (r.tercero && typeof r.tercero === "object" && r.tercero.id) return str(r.tercero.id);
  if (r.proveedor && typeof r.proveedor === "object" && r.proveedor.id) return str(r.proveedor.id);
  return "";
}

export const normalizar = (v) => str(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export const sinSociedad = (v) => normalizar(v)
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
