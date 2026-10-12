/**
 * =============================================================================
 * ODONTOCLOUD — DISPATCHER Y GESTOR DE COLA TRANSACCIONAL IHCE
 * Archivo: src/services/ihce/ihceQueueService.js
 * =============================================================================
 * Procesa la cola 'ihce_outbox_queue' de forma desacoplada y asíncrona.
 * Garantiza idempotencia, aislamiento por clínica y simulación de ciclo de vida:
 * - ACEPTADO (HTTP 201)
 * - RECHAZADO (HTTP 422 - OperationOutcome)
 * - ERROR_REINTENTO (HTTP 503 / Timeout con reintento exponencial)
 * 
 * REGLA DE SEGURIDAD: Envío real a Minsalud DESHABILITADO.
 * =============================================================================
 */

import { buildRdaConsultaExternaBundle, validateRdaBundle } from "./ihceBundleBuilder.js";

/**
 * Cliente Simulador de Vulcano / Hércules para pruebas de conformidad en desarrollo
 */
export class MockVulcanoClient {
  constructor({ mode = "SUCCESS" } = {}) {
    this.mode = mode; // "SUCCESS" | "REJECTED_422" | "NETWORK_ERROR_503"
  }

  async sendBundle(bundle, tenantCredentials) {
    // Simulación de latencia de red
    await new Promise(r => setTimeout(r, 100));

    if (this.mode === "REJECTED_422") {
      return {
        ok: false,
        status: 422,
        data: {
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "invalid",
              diagnostics: "El código de prestador REPS no coincide con la sede registrada en Hércules."
            }
          ]
        }
      };
    }

    if (this.mode === "NETWORK_ERROR_503") {
      return {
        ok: false,
        status: 503,
        error: "Servicio de Vulcano temporalmente no disponible (503 Service Unavailable)"
      };
    }

    // Modo exitoso por defecto
    const rdaId = `RDA-COL-${Date.now()}-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    return {
      ok: true,
      status: 201,
      data: {
        resourceType: "Bundle",
        id: rdaId,
        type: "document",
        timestamp: new Date().toISOString()
      },
      radicadoId: rdaId
    };
  }
}

/**
 * Procesa un registro de la cola outbox
 * @param {Object} queueItem - Fila de ihce_outbox_queue
 * @param {Object} contextData - Entidades necesarias para armar el Bundle
 * @param {MockVulcanoClient} client - Cliente HTTP (mock o real deshabilitado)
 */
export async function processQueueItem(queueItem, contextData, client = new MockVulcanoClient()) {
  try {
    // 1. Validar que la tarea no haya superado los reintentos máximos
    if (queueItem.intentos >= queueItem.max_intentos) {
      return {
        id: queueItem.id,
        status: "RECHAZADO",
        http_status: 429,
        error: `Excedido el número máximo de reintentos (${queueItem.max_intentos}).`
      };
    }

    // 2. Construir el Bundle FHIR a partir de los datos context
    const bundle = buildRdaConsultaExternaBundle(contextData);

    // 3. Validar sintaxis y referencias antes de transmitir
    const validation = validateRdaBundle(bundle);
    if (!validation.valid) {
      return {
        id: queueItem.id,
        status: "RECHAZADO",
        http_status: 400,
        error: `Error de validación FHIR R4: ${validation.errors.join("; ")}`,
        respuesta_minsalud: { errors: validation.errors }
      };
    }

    // 4. Despachar a través del cliente
    const response = await client.sendBundle(bundle, { tenantId: queueItem.tenant_id });

    if (response.ok) {
      return {
        id: queueItem.id,
        status: "ACEPTADO",
        http_status: response.status,
        radicado_rda_id: response.radicadoId,
        respuesta_minsalud: response.data,
        error: null
      };
    }

    if (response.status === 422) {
      // Error semántico no reintentable
      return {
        id: queueItem.id,
        status: "RECHAZADO",
        http_status: response.status,
        respuesta_minsalud: response.data,
        error: "Rechazo de validación oficial por Minsalud."
      };
    }

    // Error temporal reintentable (503 / 504 / timeout)
    const nextAttempts = (queueItem.intentos || 0) + 1;
    // Reintento exponencial: 2 ^ intentos minutos
    const backoffMinutes = Math.pow(2, nextAttempts);
    const nextRetryDate = new Date(Date.now() + backoffMinutes * 60 * 1000);

    return {
      id: queueItem.id,
      status: "ERROR_REINTENTO",
      intentos: nextAttempts,
      proximo_intento_at: nextRetryDate.toISOString(),
      http_status: response.status || 500,
      error: response.error || "Error de red o timeout.",
      respuesta_minsalud: response.data || null
    };
  } catch (err) {
    return {
      id: queueItem.id,
      status: "ERROR_REINTENTO",
      intentos: (queueItem.intentos || 0) + 1,
      error: err.message || "Error inesperado al procesar la cola."
    };
  }
}
