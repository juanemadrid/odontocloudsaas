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
//
// También aplica las preferencias del profesional que imprime (Configuración → Usuarios):
//   - "¿Documentos clínicos se imprimen con logo?" apagado -> se quita el logo de la cabecera.
//   - "Cabecera documentos clínicos" = Personalizado con texto -> ese texto reemplaza los datos
//     de la clínica en la cabecera. Con "Sucursal" se deja la cabecera normal.

let activeSede = null;
let printUserPrefs = null;

export const setPrintUserPrefs = (prefs) => {
    printUserPrefs = prefs && typeof prefs === "object" ? prefs : null;
};

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

const LOGO_SELECTORS = "img.clinic-logo, .header-left img, .logo-area img, .logo-container > img";

export const applyDoctorPrintPrefs = (html, prefs = printUserPrefs) => {
    if (typeof html !== "string" || !prefs || prefs.esDoctor !== true) return html;
    const sinLogo = prefs.clinicalDocsWithLogo === false;
    const custom = prefs.clinicalDocsHeader === "personalizado" ? String(prefs.encabezadoPersonalizado || "").trim() : "";
    if (!sinLogo && !custom) return html;
    if (typeof DOMParser === "undefined") return html;
    try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        if (!doc.body) return html;
        if (sinLogo) doc.querySelectorAll(LOGO_SELECTORS).forEach(img => img.remove());
        if (custom) {
            // Se arma con nodos y textContent (sin innerHTML): el texto del usuario nunca se interpreta como HTML.
            const makeBlock = () => {
                const el = doc.createElement("div");
                el.className = "oc-doc-header";
                el.setAttribute("style", "white-space:pre-line;font-weight:700;font-size:12px;line-height:1.4;color:#0f172a;");
                el.textContent = custom;
                return el;
            };
            const center = doc.querySelector(".header-center");
            const titleBox = doc.querySelector(".clinic-title")?.parentElement;
            const logoArea = doc.querySelector(".logo-area");
            if (center) center.replaceChildren(makeBlock());
            else if (titleBox) titleBox.replaceChildren(makeBlock());
            else if (logoArea) {
                logoArea.querySelectorAll(".logo-text").forEach(el => el.remove());
                logoArea.appendChild(makeBlock());
            } else {
                const wrap = doc.createElement("div");
                wrap.setAttribute("style", "margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #cbd5e1;");
                wrap.appendChild(makeBlock());
                doc.body.prepend(wrap);
            }
        }
        const doctype = /^\s*<!doctype/i.test(html) ? "<!DOCTYPE html>\n" : "";
        return doctype + doc.documentElement.outerHTML;
    } catch (_) {
        return html;
    }
};

export const applySedeFooter = (rawHtml, sede = activeSede) => {
    if (typeof rawHtml !== "string" || rawHtml.includes("oc-sede-footer")) return rawHtml;
    const html = applyDoctorPrintPrefs(rawHtml);
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
