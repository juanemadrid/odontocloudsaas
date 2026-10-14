/**
 * IHCE Auth Client — Minsalud Hércules / Gov.co / Azure APIM OAuth2 Client Credentials
 * 
 * Gestiona la autenticación independiente por clínica y profesional independiente (REPS),
 * almacenamiento temporal en memoria de tokens (caching con TTL),
 * renovación automática antes de expiración e invalidación inmediata ante HTTP 401.
 * 
 * Cumplimiento:
 * - Estándar OAuth2 RFC 6749 (Client Credentials Grant)
 * - Microsoft Entra ID / Azure API Management / MinSalud Hércules
 * - Aislamiento estricto de secretos: NINGÚN token ni credencial se imprime en logs.
 */

import { IHCE_LIVE_ENABLED, IS_PRODUCTION_BLOCKED } from './ihceConstants.js';

class IhceAuthClient {
  constructor(options = {}) {
    this.tokenCache = new Map(); // cacheKey -> { accessToken, expiresAt, scope }
    this.defaultTokenEndpoint = options.tokenEndpoint || null;
    this.mockServer = options.mockServer || null; // Para pruebas locales aisladas
    this.safetyMarginSeconds = options.safetyMarginSeconds || 300; // 5 minutos antes de expirar
  }

  /**
   * Resuelve el endpoint de token apropiado según los parámetros oficiales del Ministerio (Manual v1.3)
   */
  resolveTokenEndpoint(credentials) {
    const azureTenant = credentials.tenantIdAuth || credentials.tenantId;

    // Si viene configurado un TenantID de Azure Entra ID (GUID oficial MinSalud)
    if (azureTenant && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(azureTenant)) {
      return `https://login.microsoftonline.com/${azureTenant}/oauth2/v2.0/token`;
    }

    if (credentials.tokenEndpoint) {
      // Detección estricta: Prevenir confusión entre la API de interoperabilidad y el endpoint OAuth2
      if (credentials.tokenEndpoint.includes('ihcecol.gov.co') || credentials.tokenEndpoint.includes('/ihce')) {
        if (azureTenant) {
          return `https://login.microsoftonline.com/${azureTenant}/oauth2/v2.0/token`;
        }
        throw new Error('IHCE_CONFIG_ERROR: El endpoint suministrado corresponde a la API de interoperabilidad (ihcecol.gov.co), no a la obtención del token OAuth2. La autenticación debe realizarse exclusivamente ante login.microsoftonline.com/{TenantID}/oauth2/v2.0/token.');
      }
      return credentials.tokenEndpoint;
    }

    if (azureTenant && typeof azureTenant === 'string' && azureTenant.trim().length > 0) {
      return `https://login.microsoftonline.com/${azureTenant.trim()}/oauth2/v2.0/token`;
    }

    return this.defaultTokenEndpoint || 'https://hercules.sispro.gov.co/auth/realms/minsalud/protocol/openid-connect/token';
  }

  /**
   * Construye una clave de caché aislada por clínica y profesional/REPS
   */
  getCacheKey(credentials) {
    const tenant = credentials.tenantId || 'global';
    const prestador = credentials.doctorId || credentials.repsCode || 'default';
    return `${tenant}:${prestador}`;
  }

  /**
   * Obtiene un token de acceso válido para el prestador especificado.
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

    // Salvaguarda: Bloqueo absoluto de producción
    if (credentials.ambiente === 'PRODUCCION' && IS_PRODUCTION_BLOCKED) {
      const err = new Error('IHCE_PRODUCCION_BLOQUEADA: El ambiente de producción está estrictamente bloqueado hasta obtener el Visto Bueno oficial de conformidad de MinSalud.');
      err.statusCode = 403;
      throw err;
    }

    const cacheKey = this.getCacheKey(credentials);
    const cached = this.tokenCache.get(cacheKey);
    const now = Math.floor(Date.now() / 1000);

    // 1. Verificar si existe en caché vigente
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
        const error = new Error(`IHCE_AUTH_FAILED: ${mockResult.error_description || 'Autenticación rechazada por simulador'}`);
        error.statusCode = mockResult.statusCode || 401;
        throw error;
      }

      const expiresAt = now + (mockResult.expires_in || 3600);
      this.tokenCache.set(cacheKey, {
        accessToken: mockResult.access_token,
        expiresAt,
        scope: mockResult.scope || credentials.scope || 'ihce:write ihce:read'
      });

      return {
        accessToken: mockResult.access_token,
        cached: false,
        expiresIn: mockResult.expires_in || 3600
      };
    }

    // 3. Petición real OAuth2 Client Credentials (bloqueada estrictamente si IHCE_LIVE_ENABLED es false)
    if (!IHCE_LIVE_ENABLED) {
      const error = new Error('IHCE_LIVE_DISABLED: La adquisición externa de tokens está bloqueada por salvaguarda de seguridad. Active el runner en sandbox previa autorización.');
      error.statusCode = 403;
      throw error;
    }

    const tokenEndpoint = this.resolveTokenEndpoint(credentials);
    const scope = credentials.scope || 'ihce:write ihce:read';

    // Salvaguarda de Seguridad: Lista blanca estricta de dominios para autenticación
    const parsedEndpoint = new URL(tokenEndpoint);
    const ALLOWED_HOSTS = ['login.microsoftonline.com', 'hercules.sispro.gov.co'];
    if (parsedEndpoint.protocol !== 'https:' || !ALLOWED_HOSTS.includes(parsedEndpoint.hostname.toLowerCase())) {
      throw new Error(`SECURITY_VIOLATION: Destino de autenticación no permitido (${parsedEndpoint.hostname}). Solo se autoriza conexión contra login.microsoftonline.com.`);
    }

    try {
      const bodyParams = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: scope
      });

      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'OdontoCloud-IHCE-Auth/2.0'
      };

      if (credentials.apimSubscriptionKey) {
        headers['Ocp-Apim-Subscription-Key'] = credentials.apimSubscriptionKey;
      }

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers,
        body: bodyParams.toString()
      });

      if (!response.ok) {
        // SEGURIDAD: NO registrar el texto crudo del error si contiene secretos
        const error = new Error(`IHCE_AUTH_FAILED: Error HTTP ${response.status} al solicitar token en endpoint ministerial.`);
        error.statusCode = response.status;
        throw error;
      }

      const data = await response.json();
      const expiresAt = now + (data.expires_in || 3600);

      this.tokenCache.set(cacheKey, {
        accessToken: data.access_token,
        expiresAt,
        scope: data.scope || scope
      });

      return {
        accessToken: data.access_token,
        cached: false,
        expiresIn: data.expires_in || 3600
      };
    } catch (err) {
      if (err.statusCode) throw err;
      const networkError = new Error(`IHCE_AUTH_NETWORK_ERROR: No fue posible conectar con el servidor de autenticación de MinSalud.`);
      networkError.statusCode = 503;
      throw networkError;
    }
  }

  /**
   * Invalida de inmediato el token de un prestador (ej. al recibir un 401 de la API FHIR).
   */
  invalidateToken(credentialsOrKey) {
    if (typeof credentialsOrKey === 'string') {
      this.tokenCache.delete(credentialsOrKey);
      return;
    }
    const cacheKey = this.getCacheKey(credentialsOrKey);
    this.tokenCache.delete(cacheKey);
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
