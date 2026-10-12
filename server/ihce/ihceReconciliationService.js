/**
 * IHCE Reconciliation Service — Resiliencia y Conciliación ante Desconexión
 * 
 * Se ejecuta periódicamente en el servidor de soporte/worker para:
 * 1. Detectar tareas en estado 'PENDIENTE_CONCILIACION' o huérfanas en 'PROCESANDO'.
 * 2. Consultar al mecanismo nacional mediante operaciones oficiales verificables
 *    (ej. FHIR search por identificador/clave de idempotencia) antes de retransmitir.
 * 3. Si MinSalud confirma que el documento fue recibido y radicado: marcar 'ACEPTADO'.
 * 4. Si MinSalud confirma de forma concluyente que NO fue recibido: reprogramar reenvío seguro.
 * 5. Si NO hay una operación oficial disponible o la consulta es inconcluyente:
 *    CONSERVAR ESTADO 'PENDIENTE_CONCILIACION' y EVITAR REENVÍOS CIEGOS.
 */

import { IHCE_LIVE_ENABLED } from './ihceConstants.js';

class IhceReconciliationService {
  constructor(options = {}) {
    this.connector = options.connector;
    this.staleTimeoutMinutes = options.staleTimeoutMinutes || 10;
  }

  /**
   * Concilia un trabajo pendiente de conciliación o huérfano.
   * 
   * @param {Object} job - { id, tenant_id, evolution_id, idempotency_key, status }
   * @param {Object} dbAdapter - Adaptador de base de datos
   * @param {Object} credentials - Credenciales de la clínica
   */
  async reconcileJob(job, dbAdapter, credentials) {
    if (!job || !job.idempotency_key) {
      throw new Error('RECONCILIATION_ERROR: Clave de idempotencia requerida para conciliación.');
    }

    // 1. Consulta al mecanismo nacional mediante operación oficial verificable
    const inquiryResult = await this._queryNationalRegistryByIdempotency(job.idempotency_key, credentials);

    // Caso A: MinSalud confirmó recepción previa con radicado oficial
    if (inquiryResult.found && inquiryResult.radicado) {
      await dbAdapter.updateJobResult({
        queueId: job.id,
        status: 'ACEPTADO',
        httpStatus: 200,
        radicado: inquiryResult.radicado,
        responseFhirId: inquiryResult.fhirId || 'reconciled-fhir-id',
        detalleRespuesta: {
          reconciled: true,
          reconciled_at: new Date().toISOString(),
          original_timestamp: inquiryResult.timestamp,
          source: inquiryResult.source || 'OFFICIAL_REGISTRY_QUERY'
        }
      });

      return {
        reconciled: true,
        action: 'MARKED_ACCEPTED_EXISTING',
        radicado: inquiryResult.radicado
      };
    }

    // Caso B: MinSalud confirmó concluyentemente que el documento NO existe en el registro nacional
    if (inquiryResult.confirmedUnregistered === true) {
      await dbAdapter.updateJobResult({
        queueId: job.id,
        status: 'ERROR_REINTENTO',
        httpStatus: 504,
        errorMensaje: 'CONCILIATION: Confirmado por registro oficial que no existe radicado previo. Se reintenta con la misma clave de idempotencia.',
        proximoIntentoSegundos: 30
      });

      return {
        reconciled: true,
        action: 'RESCHEDULED_FOR_DISPATCH'
      };
    }

    // Caso C: NO hay operación oficial disponible o el resultado es inconcluyente
    // REGLA CRÍTICA: Conservar estado 'PENDIENTE_CONCILIACION' y evitar reenvíos ciegos.
    await dbAdapter.updateJobResult({
      queueId: job.id,
      status: 'PENDIENTE_CONCILIACION',
      httpStatus: 409,
      errorMensaje: 'CONCILIACION_PENDIENTE: No se dispone de operación oficial de consulta o la respuesta no es concluyente. Se retiene en PENDIENTE_CONCILIACION para evitar duplicidad o reenvío ciego.',
      detalleRespuesta: {
        reconciliation_attempted_at: new Date().toISOString(),
        reason: inquiryResult.reason || 'NO_OFFICIAL_QUERY_OPERATION_AVAILABLE',
        requires_manual_or_official_verification: true
      }
    });

    return {
      reconciled: false,
      action: 'RETAINED_PENDING_CONCILIATION',
      reason: inquiryResult.reason || 'NO_OFFICIAL_QUERY_OPERATION_AVAILABLE'
    };
  }

  async _queryNationalRegistryByIdempotency(idempotencyKey, credentials) {
    // Si la red en vivo está deshabilitada (cumplimiento estricto)
    if (!IHCE_LIVE_ENABLED) {
      // Verificar si hay servidor simulado de prueba local configurado
      if (this.connector?.mockServer && typeof this.connector.mockServer.queryByIdempotency === 'function') {
        return await this.connector.mockServer.queryByIdempotency(idempotencyKey);
      }
      return {
        available: false,
        found: false,
        confirmedUnregistered: false,
        radicado: null,
        reason: 'IHCE_LIVE_DISABLED_AND_NO_MOCK_QUERY'
      };
    }

    // En red real, consultar endpoint oficial de búsqueda FHIR por identificador
    // GET /Composition?identifier=urn:idempotency:<idempotencyKey>
    try {
      const response = await this.connector.queryDocumentByIdentifier(idempotencyKey, credentials);
      if (response && response.found && response.radicado) {
        return {
          available: true,
          found: true,
          confirmedUnregistered: false,
          radicado: response.radicado,
          fhirId: response.fhirId,
          timestamp: response.timestamp,
          source: 'MINSALUD_FHIR_SEARCH'
        };
      }
      if (response && response.notFoundConfirmed) {
        return {
          available: true,
          found: false,
          confirmedUnregistered: true,
          radicado: null
        };
      }
      return {
        available: true,
        found: false,
        confirmedUnregistered: false,
        radicado: null,
        reason: 'MINSALUD_INCONCLUSIVE_RESPONSE'
      };
    } catch (err) {
      return {
        available: false,
        found: false,
        confirmedUnregistered: false,
        radicado: null,
        reason: `OFFICIAL_QUERY_FAILED: ${err.message}`
      };
    }
  }
}

export { IhceReconciliationService };
