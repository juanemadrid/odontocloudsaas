// Numeración de facturas de venta.
// El número fiscal (p. ej. FCEV1347) lo asigna Factus/DIAN SOLO cuando acepta la
// factura. Mientras no exista, el documento lleva una etiqueta interna que NO es
// un consecutivo y nunca debe mostrarse, imprimirse ni consultarse como tal.

export const NO_FISCAL_NUMBER_LABEL = "Sin número DIAN";

// FE-1234: etiqueta antigua (últimos 4 dígitos de la hora). SIN-DIAN-…: la actual.
const PROVISIONAL_NUMBER = /^(FE-\d{1,6}|SIN-DIAN-[A-Z0-9-]+)$/i;
const DRAFT_NUMBER = /^(BORRADOR-|BORR-)/i;

const clean = (value) => String(value ?? "").trim();

export const isProvisionalInvoiceNumber = (value) => PROVISIONAL_NUMBER.test(clean(value));
export const isDraftInvoiceNumber = (value) => DRAFT_NUMBER.test(clean(value));

export const newProvisionalInvoiceNumber = (now = Date.now(), random = Math.random) => {
  const stamp = Number(now).toString(36).toUpperCase();
  const suffix = Math.floor(random() * 36 ** 3).toString(36).toUpperCase().padStart(3, "0");
  return `SIN-DIAN-${stamp}${suffix}`;
};

const details = (invoice) => (invoice?.detalles && typeof invoice.detalles === "object" ? invoice.detalles : {});

// Número fiscal real, o null si la DIAN todavía no asignó ninguno.
// El número que guardó Factus (detalles.factusInvoiceNumber) o uno con CUFE siempre es fiscal.
export const fiscalInvoiceNumber = (invoice) => {
  const d = details(invoice);
  const fromFactus = clean(d.factusInvoiceNumber);
  if (fromFactus) return fromFactus;
  const hasCufe = Boolean(d.cufe || d.factusCufe || invoice?.factusCufe || invoice?.cufe);
  const candidates = [invoice?.factusInvoiceNumber, invoice?.factusNumero, invoice?.numero, invoice?.nroFactura];
  for (const candidate of candidates) {
    const value = clean(candidate);
    if (!value || isDraftInvoiceNumber(value)) continue;
    if (hasCufe || !isProvisionalInvoiceNumber(value)) return value;
  }
  return null;
};

export const isDiscardedInvoice = (invoice) => details(invoice).descartada === true;

// Lo que ve el usuario en listas, títulos e impresiones.
export const invoiceDisplayNumber = (invoice) => {
  const fiscal = fiscalInvoiceNumber(invoice);
  if (fiscal) return fiscal;
  const raw = clean(invoice?.numero);
  if (isDraftInvoiceNumber(raw)) return raw;
  return NO_FISCAL_NUMBER_LABEL;
};
