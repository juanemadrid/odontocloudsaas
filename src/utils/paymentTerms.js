// Condiciones de pago (Configuración → Condiciones de pago) y métodos de pago (Configuración → Métodos de pago).
// Las condiciones guardan "admiteCredito" y "diasPlazo"; los métodos guardan "requiereReferencia" y el banco de destino.

const condName = (c) => (typeof c === "string" ? c : (c?.nombre || c?.label || ""));

export const findCondicionPago = (list, nombre) => {
    const target = String(nombre || "").trim().toLowerCase();
    if (!target || !Array.isArray(list)) return null;
    const found = list.find(c => condName(c).trim().toLowerCase() === target);
    return found && typeof found === "object" ? found : null;
};

// Días de plazo de una condición: lo configurado; si no hay dato, el número del nombre ("30 días" -> 30).
export const diasPlazoCondicion = (list, nombre) => {
    const cond = findCondicionPago(list, nombre);
    const raw = cond ? (cond.diasPlazo ?? cond.dias_plazo ?? cond.dias) : undefined;
    if (raw !== undefined && raw !== null && raw !== "" && !Number.isNaN(Number(raw))) return Math.max(0, Number(raw));
    const m = String(nombre || "").match(/\d+/);
    return m ? Number(m[0]) : 0;
};

// ¿Es venta a crédito? Lo configurado en la condición; si no está configurada, por el nombre.
export const esCondicionCredito = (list, nombre) => {
    const cond = findCondicionPago(list, nombre);
    if (cond && typeof cond.admiteCredito === "boolean") return cond.admiteCredito;
    if (cond && typeof cond.permiteCredito === "boolean") return cond.permiteCredito;
    const s = String(nombre || "").toLowerCase();
    return s.includes("crédito") || s.includes("credito");
};

// Fecha YYYY-MM-DD + días (sin depender de la zona horaria del navegador).
export const sumarDiasFecha = (fechaIso, dias) => {
    const [y, mo, d] = String(fechaIso || "").slice(0, 10).split("-").map(Number);
    if (!y || !mo || !d) return String(fechaIso || "").slice(0, 10);
    const dt = new Date(Date.UTC(y, mo - 1, d + (Number(dias) || 0)));
    return dt.toISOString().slice(0, 10);
};

export const findMetodoPago = (list, nombre) => {
    const target = String(nombre || "").trim().toLowerCase();
    if (!target || !Array.isArray(list)) return null;
    return list.find(m => m && typeof m === "object" && String(m.nombre || "").trim().toLowerCase() === target) || null;
};
