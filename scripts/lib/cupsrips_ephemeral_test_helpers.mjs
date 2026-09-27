import crypto from 'crypto';

export const OFFICIAL_22_SOURCE_FIELDS = [
  'Tabla',
  'Codigo',
  'Nombre',
  'Descripcion',
  'Habilitado',
  'Aplicacion',
  'IsStandardGEL',
  'IsStandardMSPS',
  'Extra_I:UsoCodigoCUP',
  'Extra_II:Qx',
  'Extra_III:NroMinimo',
  'Extra_IV:NroMaximo',
  'Extra_V:DxRequerido',
  'Extra_VI:Sexo',
  'Extra_VII:Ambito',
  'Extra_VIII:Estancia',
  'Extra_IX:Cobertura',
  'Extra_X:Duplicado',
  'ValorRegistro',
  'UsuarioResponsable',
  'Fecha_Actualizacion',
  'IsPublicPrivate'
];

/**
 * Validates that a prepared import row strictly preserves the 22 official SISPRO source columns.
 * @param {object} row - The prepared import row
 * @returns {{ valid: boolean, missingKeys: string[], extraKeys: string[] }}
 */
export function auditSourceMetadataInRow(row) {
  const sourceRecord = row?.metadata?.sourceRecord;
  if (!sourceRecord || typeof sourceRecord !== 'object') {
    return { valid: false, missingKeys: OFFICIAL_22_SOURCE_FIELDS, extraKeys: [] };
  }

  const keys = Object.keys(sourceRecord);
  const missingKeys = OFFICIAL_22_SOURCE_FIELDS.filter(k => !(k in sourceRecord));
  const extraKeys = keys.filter(k => !OFFICIAL_22_SOURCE_FIELDS.includes(k));

  return {
    valid: missingKeys.length === 0 && extraKeys.length === 0,
    missingKeys,
    extraKeys
  };
}

/**
 * In-memory PostgreSQL engine simulation replicating public.rips_catalogos
 * strictly enforcing PostgreSQL data types, NOT NULL constraints,
 * UNIQUE(catalogo, codigo, version) constraint, and idempotency/conflict rules.
 */
export class EphemeralPostgresEngine {
  constructor() {
    this.engineName = "PGlite-Compatible In-Memory PostgreSQL Engine";
    this.isPersistent = false;
    this.rowsByKey = new Map(); // key: `${catalogo}|${codigo}|${version}` -> row
  }

  _generateUuid() {
    return crypto.randomUUID();
  }

  _validateRow(row) {
    if (!row.catalogo || typeof row.catalogo !== 'string' || !row.catalogo.trim()) {
      throw new Error('PG_CONSTRAINT_NOT_NULL_VIOLATION: catalogo must be a non-empty string');
    }
    if (!row.codigo || typeof row.codigo !== 'string' || !row.codigo.trim()) {
      throw new Error('PG_CONSTRAINT_NOT_NULL_VIOLATION: codigo must be a non-empty string');
    }
    if (!row.version || typeof row.version !== 'string' || !row.version.trim()) {
      throw new Error('PG_CONSTRAINT_NOT_NULL_VIOLATION: version must be a non-empty string');
    }
    if (typeof row.activo !== 'boolean') {
      throw new Error('PG_TYPE_BOOLEAN_VIOLATION: activo must be a boolean');
    }
    if (typeof row.descripcion !== 'string' || !row.descripcion.trim()) {
      throw new Error('PG_CONSTRAINT_NOT_NULL_VIOLATION: descripcion must be a non-empty text');
    }
    if (row.vigencia_desde && !/^\d{4}-\d{2}-\d{2}$/.test(row.vigencia_desde)) {
      throw new Error('PG_TYPE_DATE_VIOLATION: vigencia_desde must be YYYY-MM-DD');
    }
    if (row.vigencia_hasta && !/^\d{4}-\d{2}-\d{2}$/.test(row.vigencia_hasta)) {
      throw new Error('PG_TYPE_DATE_VIOLATION: vigencia_hasta must be null or YYYY-MM-DD');
    }
    if (!row.metadata || typeof row.metadata !== 'object') {
      throw new Error('PG_TYPE_JSONB_VIOLATION: metadata must be a valid JSON object');
    }

    const tipoRips = row.metadata?.tipoRips;
    const allowedTipos = ['consulta', 'procedimiento', 'otrosServicios'];
    if (!tipoRips || !allowedTipos.includes(tipoRips)) {
      throw new Error(`UNSUPPORTED_TIPO_RIPS: ${tipoRips}`);
    }
  }

  insert(rawRow) {
    this._validateRow(rawRow);

    const key = `${rawRow.catalogo}|${rawRow.codigo}|${rawRow.version}`;
    const now = new Date().toISOString();

    if (this.rowsByKey.has(key)) {
      const existing = this.rowsByKey.get(key);
      
      // Compare payload fields (excluding id, created_at, updated_at)
      const existingPayload = JSON.stringify({
        catalogo: existing.catalogo,
        codigo: existing.codigo,
        descripcion: existing.descripcion,
        version: existing.version,
        rips_schema_version: existing.rips_schema_version,
        cups_resolution: existing.cups_resolution,
        cups_vigencia: existing.cups_vigencia,
        vigencia_desde: existing.vigencia_desde,
        vigencia_hasta: existing.vigencia_hasta,
        activo: existing.activo,
        fuente_oficial: existing.fuente_oficial,
        metadata: existing.metadata
      });

      const newPayload = JSON.stringify({
        catalogo: rawRow.catalogo,
        codigo: rawRow.codigo,
        descripcion: rawRow.descripcion,
        version: rawRow.version,
        rips_schema_version: rawRow.rips_schema_version,
        cups_resolution: rawRow.cups_resolution,
        cups_vigencia: rawRow.cups_vigencia,
        vigencia_desde: rawRow.vigencia_desde,
        vigencia_hasta: rawRow.vigencia_hasta,
        activo: rawRow.activo,
        fuente_oficial: rawRow.fuente_oficial,
        metadata: rawRow.metadata
      });

      if (existingPayload === newPayload) {
        // Idempotent no-op
        return { status: 'NO_OP', key, inserted: false, duplicate: true };
      } else {
        throw new Error(`SNAPSHOT_CONTENT_CONFLICT: Conflict key ${key} with divergent payload`);
      }
    }

    const storedRow = {
      id: this._generateUuid(),
      catalogo: rawRow.catalogo,
      codigo: rawRow.codigo,
      descripcion: rawRow.descripcion,
      version: rawRow.version,
      rips_schema_version: rawRow.rips_schema_version,
      cups_resolution: rawRow.cups_resolution,
      cups_vigencia: rawRow.cups_vigencia,
      vigencia_desde: rawRow.vigencia_desde,
      vigencia_hasta: rawRow.vigencia_hasta || null,
      activo: rawRow.activo,
      fuente_oficial: rawRow.fuente_oficial,
      metadata: JSON.parse(JSON.stringify(rawRow.metadata)),
      created_at: now,
      updated_at: now
    };

    this.rowsByKey.set(key, storedRow);
    return { status: 'INSERTED', key, inserted: true, duplicate: false };
  }

  insertMany(rows) {
    let insertedCount = 0;
    let duplicateCount = 0;

    for (const r of rows) {
      const res = this.insert(r);
      if (res.inserted) insertedCount++;
      if (res.duplicate) duplicateCount++;
    }

    return {
      totalProcessed: rows.length,
      insertedCount,
      duplicateCount,
      currentTotalRows: this.rowsByKey.size
    };
  }

  queryOneByCodigo(codigo) {
    for (const row of this.rowsByKey.values()) {
      if (row.codigo === codigo) {
        return row;
      }
    }
    return null;
  }

  queryManyByTipoRips(tipoRips, limit = 5) {
    const results = [];
    for (const row of this.rowsByKey.values()) {
      if (row.metadata?.tipoRips === tipoRips) {
        results.push(row);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  countTotal() {
    return this.rowsByKey.size;
  }

  countDistinctCodigo() {
    const set = new Set();
    for (const row of this.rowsByKey.values()) {
      set.add(row.codigo);
    }
    return set.size;
  }

  deleteByCatalogoAndVersion(catalogo, version) {
    const keysToDelete = [];
    for (const [key, row] of this.rowsByKey.entries()) {
      if (row.catalogo === catalogo && row.version === version) {
        keysToDelete.push(key);
      }
    }

    for (const k of keysToDelete) {
      this.rowsByKey.delete(k);
    }

    return {
      deletedCount: keysToDelete.length,
      remainingCount: this.rowsByKey.size
    };
  }
}
