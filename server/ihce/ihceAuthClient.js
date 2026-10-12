/**
 * IHCE Auth Client — Minsalud Hércules / Gov.co OAuth2 Client Credentials
 * 
 * Gestiona la autenticación independiente por clínica (tenant),
 * almacenamiento temporal en memoria de tokens (caching con TTL),
 * renovación automática antes de expiración y manejo de revocación (HTTP 401).
 * 
 * Cumplimiento: Estándar OAuth2 RFC 6749, Perfiles de Seguridad MinSalud 2026.
 */

import { IHCE_LIVE_ENABLED } from './ihceConstants.js';

class IhceAuthClient {
  constructor(options = {}) {
    this.tokenCache = new Map(); // tenantId -> { accessToken, expiresAt, scope }
    this.tokenEndpoint = options.tokenEndpoint || 'https://hercules.sispro.gov.co/auth/realms/minsalud/protocol/openid-connect/token';
    this.mockServer = options.mockServer || null; // Para pruebas locales aisladas
    this.safetyMarginSeconds = options.safetyMarginSeconds || 300; // 5 minutos antes de expirar
  }

  /**
   * Obtiene un token de acceso válido para el tenant especificado.
   * Si el token está en caché y vigente, lo retorna sin realizar petición de red.
   */
  async getAccessToken(credentials) {
    const { tenantId, clientId, clientSecret, repsCode } = credentials;

    if (!tenantId) {
      throw new Error('IHCE_AUTH_ERROR: tenantId es requerido para aislar credenciales.');
    }

    if (!clientId || !clientSecret) {
      throw new Error('IHCE_AUTH_ERROR: Las credenciales (clientId / clientSecret) no están configuradas.');
    }

    // 1. Verificar si existe en caché vigente
    const cached = this.tokenCache.get(tenantId);
    const now = Math.floor(Date.now() / 1000);

    if (cached && cached.expiresAt > now + this.safetyMarginSeconds) {
      return {
        accessToken: cached.accessToken,
        cached: true,
        expiresIn: cached.expiresAt - now
      };
    }

    // 2. Si hay un simulador mock configurado, procesar internamente
    if (this.mockServer) {
      const mockResult = await this.mockServer.authenticate({
        clientId,
        clientSecret,
        repsCode
      });

      if (!mockResult.success) {
        const error = new Error(`IHCE_AUTH_FAILED: ${mockResult.error_description || 'Autenticación rechazada'}`);
        error.statusCode = mockResult.statusCode || 401;
        throw error;
      }

      const expiresAt = now + (mockResult.expires_in || 3600);
      this.tokenCache.set(tenantId, {
        accessToken: mockResult.access_token,
        expiresAt,
        scope: mockResult.scope || 'ihce:write ihce:read'
      });

      return {
        accessToken: mockResult.access_token,
        cached: false,
        expiresIn: mockResult.expires_in || 3600
      };
    }

    // 3. Petición real OAuth2 Client Credentials (bloqueada estrictamente si IHCE_LIVE_ENABLED es false)
    if (!IHCE_LIVE_ENABLED) {
      const error = new Error('IHCE_LIVE_DISABLED: La adquisición externa de tokens Hércules OAuth2 está bloqueada por salvaguarda de seguridad.');
      error.statusCode = 403;
      throw error;
    }

    try {
      const bodyParams = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'ihce:write ihce:read'
      });

      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'OdontoCloud-IHCE-Auth/2.0'
        },
        body: bodyParams.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`IHCE_AUTH_FAILED: Error ${response.status} al solicitar token: ${errorText}`);
        error.statusCode = response.status;
        throw error;
      }

      const data = await response.json();
      const expiresAt = now + (data.expires_in || 3600);

      this.tokenCache.set(tenantId, {
        accessToken: data.access_token,
        expiresAt,
        scope: data.scope
      });

      return {
        accessToken: data.access_token,
        cached: false,
        expiresIn: data.expires_in || 3600
      };
    } catch (err) {
      if (err.statusCode) throw err;
      const networkError = new Error(`IHCE_AUTH_NETWORK_ERROR: No fue posible conectar con Hércules OAuth2: ${err.message}`);
      networkError.statusCode = 503;
      throw networkError;
    }
  }

  /**
   * Invalida de inmediato el token de un tenant (ej. al recibir un 401 de la API FHIR).
   */
  invalidateToken(tenantId) {
    if (this.tokenCache.has(tenantId)) {
      this.tokenCache.delete(tenantId);
    }
  }

  /**
   * Limpia toda la caché (para reinicio de pruebas).
   */
  clearCache() {
    this.tokenCache.clear();
  }
  async acquireToken(credentials) {
    return this.getAccessToken(credentials);
  }
}

export { IhceAuthClient };
