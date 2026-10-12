/**
 * IHCE Outbox Worker — Procesador Asíncrono de Interoperabilidad
 * 
 * Ejecuta la reserva segura de trabajos con bloqueo de concurrencia (FOR UPDATE SKIP LOCKED),
 * ensambla los recursos FHIR R4 requeridos, despacha hacia el conector nacional y
 * actualiza el resultado atómicamente en PostgreSQL sin alterar la evolución clínica local.
 */

import { buildRdaConsultaExternaBundle, validateRdaBundle } from './ihceBundleBuilder.js';
import { IhceNationalConnector } from './ihceNationalConnector.js';

class IhceWorker {
  constructor(options = {}) {
    this.workerId = options.workerId || `worker-${Math.random().toString(36).substring(2, 9)}`;
    this.connector = options.connector || new IhceNationalConnector(options);
    this.batchSize = options.batchSize || 10;
    this.lockTimeoutSeconds = options.lockTimeoutSeconds || 300;
    this.dbClient = options.dbClient || null; // Función o cliente para interactuar con la BD
  }

  /**
   * Ejecuta una ronda de procesamiento sobre la cola transaccional.
   * 
   * @param {Object} dbContext - Adaptador para ejecutar SQL o RPCs
   * @returns {Object} Resumen de trabajos procesados en esta ronda
   */
  async processCycle(dbContext) {
    const db = dbContext || this.dbClient;
    if (!db) {
      throw new Error('IHCE_WORKER_ERROR: dbContext es requerido para ejecutar claim y update.');
    }

    // 1. Reservar lote de trabajos con bloqueo SKIP LOCKED
    const claimedJobs = await db.claimBatch({
      batchSize: this.batchSize,
      workerId: this.workerId,
      lockTimeoutSeconds: this.lockTimeoutSeconds
    });

    if (!claimedJobs || claimedJobs.length === 0) {
      return { processed: 0, accepted: 0, rejected: 0, retried: 0 };
    }

    let acceptedCount = 0;
    let rejectedCount = 0;
    let retriedCount = 0;

    for (const job of claimedJobs) {
      try {
        // 2. Obtener contexto completo para ensamblar el Bundle
        const clinicalContext = await db.getJobClinicalContext(job);

        // 3. Obtener credenciales de la clínica
        const credentials = await db.getTenantCredentials(job.tenant_id);

        if (!credentials || !credentials.is_active) {
          // Si la clínica no ha configurado o activado IHCE, no reintentamos de inmediato
          await db.updateJobResult({
            queueId: job.id || job.queue_id,
            status: 'ERROR_REINTENTO',
            httpStatus: 403,
            errorMensaje: 'Clínica con interoperabilidad IHCE no configurada o inactiva.',
            proximoIntentoSegundos: 3600
          });
          retriedCount++;
          continue;
        }

        // 4. Construir y validar el Bundle FHIR R4
        const bundle = buildRdaConsultaExternaBundle(clinicalContext);
        const validation = validateRdaBundle(bundle);

        if (!validation.valid) {
          await db.updateJobResult({
            queueId: job.id || job.queue_id,
            status: 'RECHAZADO',
            httpStatus: 422,
            errorMensaje: `VALIDATION_FAILED: ${validation.errors.join('; ')}`,
            detalleRespuesta: { validation_errors: validation.errors }
          });
          rejectedCount++;
          continue;
        }

        // 5. Despachar a través del conector nacional
        const dispatchResult = await this.connector.submitRdaBundle({
          bundle,
          credentials: {
            tenantId: job.tenant_id,
            clientId: credentials.client_id,
            clientSecret: credentials.client_secret,
            repsCode: credentials.codigo_habilitacion_reps
          },
          idempotencyKey: job.idempotency_key
        });

        // 6. Actualizar registro en PostgreSQL
        await db.updateJobResult({
          queueId: job.id || job.queue_id,
          status: dispatchResult.status,
          httpStatus: dispatchResult.httpStatus,
          radicado: dispatchResult.radicado || null,
          responseFhirId: dispatchResult.responseFhirId || null,
          detalleRespuesta: dispatchResult.detalle || null,
          proximoIntentoSegundos: dispatchResult.retryAfterSeconds || 60,
          errorMensaje: dispatchResult.error || null
        });

        if (dispatchResult.status === 'ACEPTADO') {
          acceptedCount++;
        } else if (dispatchResult.status === 'RECHAZADO' || dispatchResult.status === 'ERROR_DEFINITIVO') {
          rejectedCount++;
        } else {
          retriedCount++;
        }

      } catch (jobErr) {
        // En caso de excepción imprevista en el hilo de ejecución del trabajo
        await db.updateJobResult({
          queueId: job.id || job.queue_id,
          status: 'ERROR_REINTENTO',
          httpStatus: 500,
          errorMensaje: `WORKER_INTERNAL_ERROR: ${jobErr.message}`,
          proximoIntentoSegundos: 60
        });
        retriedCount++;
      }
    }

    return {
      processed: claimedJobs.length,
      accepted: acceptedCount,
      rejected: rejectedCount,
      retried: retriedCount
    };
  }
}

export { IhceWorker };
