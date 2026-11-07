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
console.log('OK: filtro de egresos por tercero.');
