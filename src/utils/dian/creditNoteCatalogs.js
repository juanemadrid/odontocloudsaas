/**
 * src/utils/dian/creditNoteCatalogs.js
 * Catálogo centralizado de conceptos de corrección para Nota Crédito electrónica Factus / DIAN.
 * 
 * Basado en la Resolución DIAN 000042 / Anexo Técnico 1.9 y API Factus v2:
 * 1 = Devolución parcial / no aceptación parcial
 * 2 = Anulación de factura electrónica
 * 3 = Rebaja o descuento parcial o total
 * 4 = Ajuste de precio
 * 5 = Descuento por pronto pago
 * 6 = Descuento por volumen
 */

export const CREDIT_NOTE_CONCEPTS = [
  {
    code: '1',
    name: 'Devolución de parte de los bienes; no aceptación de partes del servicio',
    shortName: 'Devolución parcial / no aceptación parcial',
    tipo: 'PARCIAL',
    description: 'Ajuste por devolución física o desistimiento de ítems/servicios específicos.'
  },
  {
    code: '2',
    name: 'Anulación de factura electrónica',
    shortName: 'Anulación de factura electrónica',
    tipo: 'TOTAL',
    description: 'Anulación total de la factura fiscal. Debe acreditar el 100% del saldo elegible.'
  },
  {
    code: '3',
    name: 'Rebaja o descuento parcial o total',
    shortName: 'Rebaja o descuento parcial o total',
    tipo: 'PARCIAL',
    description: 'Descuento o rebaja monetaria otorgada con posterioridad a la emisión.'
  },
  {
    code: '4',
    name: 'Ajuste de precio',
    shortName: 'Ajuste de precio',
    tipo: 'PARCIAL',
    description: 'Modificación del valor unitario o total cobrado previamente.'
  },
  {
    code: '5',
    name: 'Descuento comercial por pronto pago',
    shortName: 'Descuento por pronto pago',
    tipo: 'PARCIAL',
    description: 'Beneficio concedido por pago anticipado o puntual.'
  },
  {
    code: '6',
    name: 'Descuento comercial por volumen de ventas',
    shortName: 'Descuento por volumen',
    tipo: 'PARCIAL',
    description: 'Beneficio concedido por volumen acumulado.'
  }
];

export const CREDIT_NOTE_CONCEPTS_BY_CODE = Object.freeze(
  CREDIT_NOTE_CONCEPTS.reduce((acc, curr) => {
    acc[curr.code] = curr;
    return acc;
  }, {})
);

/**
 * Determina si el concepto corresponde a anulación total de la factura.
 * @param {string|number} code 
 * @returns {boolean}
 */
export function isTotalCreditNoteConcept(code) {
  return String(code).trim() === '2';
}

/**
 * Determina si el concepto corresponde a ajuste o corrección parcial.
 * @param {string|number} code 
 * @returns {boolean}
 */
export function isPartialCreditNoteConcept(code) {
  const c = String(code).trim();
  return ['1', '3', '4', '5', '6'].includes(c);
}

/**
 * Obtiene la definición y metadatos de un concepto de corrección.
 * @param {string|number} code 
 * @returns {object|null}
 */
export function getCreditNoteConcept(code) {
  return CREDIT_NOTE_CONCEPTS_BY_CODE[String(code).trim()] || null;
}

/**
 * Obtiene el label amigable para mostrar en interfaces y resúmenes.
 * @param {string|number} code 
 * @returns {string}
 */
export function getCreditNoteConceptLabel(code) {
  const concept = getCreditNoteConcept(code);
  return concept ? `${concept.code} - ${concept.shortName}` : `Concepto ${code}`;
}
