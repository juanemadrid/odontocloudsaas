export const TIPOS_IDENTIFICACION = {
    '13': 'Cédula de Ciudadanía',
    '31': 'NIT',
    '11': 'Registro Civil',
    '12': 'Tarjeta de Identidad',
    '21': 'Tarjeta de Extranjería',
    '41': 'Pasaporte',
    '42': 'Documento de Identificación Extranjero'
};

export const FORMAS_PAGO = {
    '1': 'Contado',
    '2': 'Crédito'
};

export const MEDIOS_PAGO = {
    '10': 'Efectivo',
    '31': 'Transferencia Débito Bancaria',
    '41': 'Cheque',
    '42': 'Consignación Bancaria',
    '47': 'Transferencia Crédito Bancaria',
    '71': 'Bonos',
    '72': 'Vales'
};

export const TIPOS_IMPUESTO = {
    '01': { nombre: 'IVA', id: '01', agency: 'DIAN' },
    '03': { nombre: 'ICA', id: '03', agency: 'DIAN' },
    '04': { nombre: 'Impuesto Nacional al Consumo', id: '04', agency: 'DIAN' }
};

export const UNIDADES_MEDIDA = {
    '94': 'Unidad', // WSD - Standard Unit
    'HUR': 'Hora',
    'MON': 'Mes'
};

export const TIPO_DOCUMENTO = {
    'FACTURA': '01',
    'NOTA_CREDITO': '91',
    'NOTA_DEBITO': '92'
};

export const CODIGOS_RESPONSABILIDAD = [
    'R-99-PN', // No responsable (Persona Natural)
    'O-13', // Gran Contribuyente
    'O-15', // Autorretenedor
    'O-23', // Regimen Común (Responsable IVA)
    'O-47', // Regimen Simple
    'O-48', // Impuesto sobre las ventas - IVA
    'O-49' // No responsable de IVA
];
