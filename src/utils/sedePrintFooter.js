// Pie de página de la sede en los documentos clínicos impresos o descargados en PDF
// (historia clínica, consultas, evoluciones, odontograma, periodontograma).
//
// Se configura en Configuración → Sucursales:
//   - "Pie de página en documentos clínicos" (mostrarPie) apagado  -> no se agrega pie.
//   - encendido y sin texto personalizado -> salen los datos de la sede
//     (nombre, dirección, ciudad, teléfonos y correo).
//   - encendido con "Pie de página personalizado" -> sale solo ese texto.
//
// SedeContext publica aquí la sede activa; las funciones de impresión llaman a applySedeFooter.

let activeSede = null;

export const setActiveSedeForPrint = (sede) => {
    activeSede = sede && typeof sede === "object" ? sede : null;
};

const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildSedeFooterText = (sede = activeSede) => {
    if (!sede || !sede.mostrarPie) return "";
    const custom = String(sede.piePersonalizado || "").trim();
    if (custom) return custom;
    const lugar = [sede.direccion, sede.ciudad].map(v => String(v || "").trim()).filter(Boolean).join(", ");
    return [
        String(sede.nombre || "").trim(),
        lugar,
        sede.telefono ? `Tel. ${String(sede.telefono).trim()}` : "",
        sede.celular ? `Cel. ${String(sede.celular).trim()}` : "",
        String(sede.email || "").trim(),
    ].filter(Boolean).join("  ·  ");
};

export const applySedeFooter = (html, sede = activeSede) => {
    if (typeof html !== "string" || html.includes("oc-sede-footer")) return html;
    const text = buildSedeFooterText(sede);
    if (!text) return html;
    const block = `
<style>
  .oc-sede-footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 6px 18px; border-top: 1px solid #cbd5e1;
    background: #ffffff; color: #475569; font: 10px/1.4 Arial, Helvetica, sans-serif; text-align: center; white-space: pre-line; }
  @media print { body { padding-bottom: 46px !important; } }
</style>
<div class="oc-sede-footer">${escapeHtml(text)}</div>
`;
    return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${block}</body>`) : `${html}${block}`;
};
