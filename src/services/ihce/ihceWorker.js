/**
 * IHCE Outbox Worker — Procesador Asíncrono de Interoperabilidad
 * 
 * Ejecuta la reserva segura de trabajos con bloqueo de concurrencia (FOR UPDATE SKIP LOCKED),
 * resuelve las credenciales autorizadas del profesional independiente que brindó la atención,
 * ensambla los recursos FHIR R4 requeridos, despacha hacia el conector nacional y
 * actualiza el resultado atómicamente en PostgreSQL sin alterar la evolución clínica local.
 * 
 * Reglas de Seguridad Multi-Profesional:
 * 1. Cada atención se asocia al prestador REPS bajo cuya habilitación fue realizada.
 * 2. Las credenciales de un odontólogo NUNCA se utilizan para despachar atenciones de otro.
 * 3. Si un profesional independiente no tiene llaves configuradas, el trabajo se retiene
 *    sin suplantar la identidad de otro prestador.
 */

import { buildRdaConsultaExternaBundle, validateRdaBundle } from './ihceBundleBuilder.js';
import { IhceNationalConnector } from './ihceNationalConnector.js';
import { decryptSecret } from './ihceCrypto.js';

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
        // 2. Obtener contexto clínico completo para ensamblar el Bundle
        const clinicalContext = await db.getJobClinicalContext(job);
        const doctorId = clinicalContext.practitioner?.id || clinicalContext.evolution?.doctor_id;
        const doctorReps = clinicalContext.practitioner?.codigo_habilitacion_reps || 
                           clinicalContext.evolution?.reps_prestador ||
                           clinicalContext.organization?.codigo_habilitacion_reps;

        // 3. Resolución segura de credenciales por Prestador / Doctor
        let credentials;
        if (typeof db.getPrestadorCredentials === 'function') {
          credentials = await db.getPrestadorCredentials({
            tenantId: job.tenant_id,
            doctorId,
            repsCode: doctorReps
          });
        } else if (typeof db.getTenantCredentials === 'function') {
          credentials = await db.getTenantCredentials(job.tenant_id);
        }

        if (!credentials || !credentials.is_active) {
          // Si el profesional no tiene credenciales IHCE configuradas, NO se envían con las de otro
          await db.updateJobResult({
            queueId: job.id || job.queue_id,
            status: 'ERROR_REINTENTO',
            httpStatus: 403,
            errorMensaje: `CREDENTIALS_MISSING: Profesional (${clinicalContext.practitioner?.nombre_completo || doctorId || 'No asignado'}) sin credenciales IHCE autorizadas. Bloqueado para evitar suplantación entre prestadores.`,
            proximoIntentoSegundos: 3600
          });
          retriedCount++;
          continue;
        }

        // 4. Verificación estricta de coherencia REPS (Previene suplantación de prestador)
        if (doctorReps && credentials.codigo_habilitacion_reps && credentials.codigo_habilitacion_reps !== doctorReps) {
          await db.updateJobResult({
            queueId: job.id || job.queue_id,
            status: 'RECHAZADO',
            httpStatus: 403,
            errorMensaje: `SECURITY_VIOLATION: Conflicto de habilitación REPS. El REPS de la atención (${doctorReps}) no coincide con las credenciales asignadas (${credentials.codigo_habilitacion_reps}). Prohibido transmitir bajo la identidad de otro prestador.`,
            isTerminal: true
          });
          rejectedCount++;
          continue;
        }

        // 5. Construir y validar el Bundle FHIR R4
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

        // 6. Descifrado autenticado de secretos en memoria si vienen en sobre AES-256-GCM
        let clientSecret = credentials.client_secret || null;
        let apimKey = credentials.apim_subscription_key || credentials.apimSubscriptionKey || null;

        if (credentials.client_secret_envelope) {
          try {
            const aad = `prestador:${credentials.codigo_habilitacion_reps}:tenant:${job.tenant_id}`;
            clientSecret = await decryptSecret(credentials.client_secret_envelope, aad);
          } catch (decryptErr) {
            await db.updateJobResult({
              queueId: job.id || job.queue_id,
              status: 'ERROR_REINTENTO',
              httpStatus: 500,
              errorMensaje: `CRYPTO_DECRYPT_FAILED: Error al descifrar client_secret del prestador: ${decryptErr.message}`,
              proximoIntentoSegundos: 300
            });
            retriedCount++;
            continue;
          }
        }

        if (credentials.apim_subscription_key_envelope) {
          try {
            const aad = `prestador:${credentials.codigo_habilitacion_reps}:tenant:${job.tenant_id}`;
            apimKey = await decryptSecret(credentials.apim_subscription_key_envelope, aad);
          } catch (decryptErr) {
            await db.updateJobResult({
              queueId: job.id || job.queue_id,
              status: 'ERROR_REINTENTO',
              httpStatus: 500,
              errorMensaje: `CRYPTO_DECRYPT_FAILED: Error al descifrar apim_subscription_key del prestador: ${decryptErr.message}`,
              proximoIntentoSegundos: 300
            });
            retriedCount++;
            continue;
          }
        }

        // 7. Despachar a través del conector nacional utilizando exclusivamente las llaves del prestador autorizado
        const dispatchResult = await this.connector.submitRdaBundle({
          bundle,
          credentials: {
            tenantId: job.tenant_id,
            doctorId: doctorId,
            clientId: credentials.client_id,
            clientSecret: clientSecret,
            tenantIdAuth: credentials.tenant_id_auth || credentials.tenantId,
            scope: credentials.scope,
            apimSubscriptionKey: apimKey,
            endPoint: credentials.api_fhir_endpoint || credentials.endPoint,
            tokenEndpoint: credentials.token_endpoint || credentials.tokenEndpoint,
            repsCode: credentials.codigo_habilitacion_reps,
            sedeCode: credentials.codigo_sede_reps || '01',
            servicioCode: credentials.codigo_servicio_reps || '334',
            ambiente: credentials.ambiente
          },
          idempotencyKey: job.idempotency_key
        });

        // 7. Actualizar registro atómicamente en PostgreSQL
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
