// Asociar egreso: solo se ofrecen los egresos del mismo tercero de la factura / documento soporte.
import assert from 'node:assert/strict';
import { mismoTercero, terceroNombre, terceroDocumento } from '../src/utils/terceroMatch.js';

const factura = { id: 'fc1', proveedor: 'CASA ROSA GROUP SAS', documentoTercero: '901234567-8', terceroId: 't9' };
assert.equal(mismoTercero(factura, { terceroId: 't9', proveedor: 'Otro nombre' }), true, 'mismo id de tercero');
assert.equal(mismoTercero(factura, { proveedor: 'Casa Rosa Group S.A.S.', documentoTercero: '' }), true, 'mismo nombre sin importar SAS/puntos');
assert.equal(mismoTercero(factura, { proveedor: 'C.R.G', documentoTercero: '901234567' }), true, 'mismo NIT sin dígito de verificación');
assert.equal(mismoTercero(factura, { proveedor: 'COMCEL S.A', documentoTercero: '800153993' }), false, 'otro tercero');
assert.equal(mismoTercero(factura, { proveedor: 'Caja Menor / Gastos Varios' }), false, 'caja menor no es el proveedor');
assert.equal(mismoTercero(factura, null), false);
assert.equal(mismoTercero({ proveedor: 'ELIECER JOSE HERNANDES DEL CASTILLO' }, { proveedor: 'Eliecer José Hernandes del Castillo' }), true, 'tildes y mayúsculas');
assert.equal(mismoTercero({ documentoTercero: '12' }, { documentoTercero: '12' }), false, 'documentos muy cortos no cuentan');
assert.equal(terceroNombre({ tercero: { nombre: 'ANA' } }), 'ANA');
assert.equal(terceroDocumento({ terceroObj: { documento: '123456' } }), '123456');

// Con el nombre corregido a su forma apropiada con Z y tildes:
const egreso1663 = {
  id: 'pago_liq_1663',
  consecutivo: '1663',
  tercero: 'ELIECER JOSE HERNÁNDEZ DEL CASTILLO',
  proveedor: 'ELIECER JOSE HERNÁNDEZ DEL CASTILLO',
  concepto: 'Liquidación comisiones',
  monto: 1248000
};
const dcse789Corregido = {
  id: 'fc_789',
  nroFactura: 'DCSE789',
  proveedor: 'ELIECER JOSE HERNÁNDEZ DEL CASTILLO',
  documentoTercero: '1083043573',
  terceroId: 'tercero_eliecer'
};
assert.equal(mismoTercero(egreso1663, dcse789Corregido), true, 'egreso 1663 coincide con DCSE789 con el nombre correcto con Z');
assert.equal(mismoTercero({ proveedor: 'ELIECER HERNANDEZ' }, { proveedor: 'ELIECER HERNANDES' }), false, 'sin tolerancia fonetica: nombres mal escritos no coinciden');

console.log('OK: filtro de egresos por tercero.');
