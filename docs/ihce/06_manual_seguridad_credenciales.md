# 06. MANUAL DE SEGURIDAD, CREDENCIALES Y CICLO DE VIDA IHCE

**Alcance:** Políticas de custodia criptográfica, gestión de secretos y ciclo de vida de tokens para el sistema de interoperabilidad.

---

## 1. Política de Aislamiento de Secretos

1. **Prohibición Absoluta de Secretos en el Frontend:**  
   Bajo ninguna circunstancia las claves secretas de integración (`client_secret`), tokens de acceso o certificados se exponen en el código del navegador del cliente. Todas las comunicaciones hacia Hércules y MinSalud se realizan en el backend.
2. **Aislamiento Multi-Tenant de Credenciales:**  
   Las credenciales de una clínica están estrictamente confinadas a su `tenant_id` mediante políticas RLS con chequeo de usuario activo (`is_active_user() AND tenant_id = get_user_tenant_id()`). Ni siquiera los superadministradores de la plataforma tienen acceso a los secretos de las clínicas.

---

## 2. Ciclo de Vida del Token OAuth2 (Hércules / Gov.co)

- **Flujo:** Client Credentials Grant (RFC 6749).
- **Caché en Memoria:** Los tokens emitidos se almacenan en memoria volátil de forma aislada por `tenant_id`.
- **Margen de Seguridad (TTL):** El cliente de autenticación (`IhceAuthClient`) renueva el token 5 minutos antes de su vencimiento oficial para evitar errores durante transacciones en vuelo.
- **Invalidación Proactiva:** Si el API ministerial devuelve un código HTTP 401, el cliente de autenticación purga de inmediato el token de la memoria y solicita uno nuevo antes del siguiente reintento.

---

## 3. Protocolo de Rotación de Credenciales

En caso de sospecha de compromiso o por política periódica de la clínica:
1. El Administrador de la clínica ingresa a MinSalud / SISPRO y solicita la regeneración del `Client Secret`.
2. En OdontoCloud (`/interoperabilidad-ihce`), ingresa a la pestaña **"Configuración del Prestador"**.
3. Pega el nuevo `Client Secret` y guarda los cambios.
4. El sistema purga la caché de tokens y comienza a autenticar inmediatamente con la nueva credencial.
5. El evento queda registrado en `audit_logs` con fecha, hora e IP del administrador que realizó la rotación.
