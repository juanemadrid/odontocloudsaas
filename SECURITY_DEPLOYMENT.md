# Despliegue del endurecimiento de seguridad

Los cambios de frontend dependen de la migracion y de las Edge Functions nuevas. No publique el frontend antes de completar los pasos 1 a 4.

## 1. Rotar secretos expuestos

1. Rote inmediatamente la clave `service_role` de Supabase que estuvo incluida en codigo cliente.
2. Rote cualquier clave Gemini que se haya guardado en `VITE_GEMINI_API_KEY` o localStorage.
3. Rote el token permanente de WhatsApp si alguna vez se construyo el frontend con `VITE_WA_TOKEN`.
4. Rote credenciales Factus que hayan estado dentro de `website_config`.
5. Rote la credencial de las cuentas usadas por scripts diagnósticos antiguos; ahora se recibe únicamente mediante `ODONTOCLOUD_TEST_PASSWORD` en el entorno local.

No use prefijos `VITE_` para tokens, contrasenas o secretos. Todo valor Vite termina en JavaScript publico.

## 2. Vincular el proyecto y aplicar migraciones

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

`db push` debe aplicar, en este orden:

1. `20260801_security_hardening.sql`
2. `20260802_agenda_rls_policies.sql`
3. `20260803_production_agenda_availability.sql`

La primera migracion migra Gemini y Factus a `tenant_secrets`, revoca RPC administrativos heredados, reconstruye RLS multi-tenant, privatiza `adjuntos` y crea las tablas privadas de sesiones, rate limit y auditoria minima. La tercera normaliza los horarios, elimina contraseñas heredadas de `website_config` y activa el trigger transaccional de disponibilidad de citas.

## 3. Configurar secretos de Edge Functions

Supabase proporciona automaticamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a las funciones.

```bash
supabase secrets set GEMINI_API_KEY=<opcional-clave-central>
supabase secrets set WA_TOKEN=<token-meta> WA_PHONE_ID=<phone-number-id>
supabase secrets set WA_TEMPLATE_CONFIRMACION=cita_confirmacion
supabase secrets set WA_TEMPLATE_RECORDATORIO=cita_recordatorio
supabase secrets set WA_TEMPLATE_LANGUAGE=es_CO WA_GRAPH_API_VERSION=<version-soportada>
```

Las credenciales Factus y las claves Gemini por clinica se configuran desde la aplicacion. Nunca deben configurarse como variables `VITE_`.

## 4. Desplegar Edge Functions

```bash
supabase functions deploy admin-users
supabase functions deploy factus-proxy
supabase functions deploy gemini-proxy
supabase functions deploy whatsapp-proxy
supabase functions deploy register-clinic --no-verify-jwt
supabase functions deploy patient-portal --no-verify-jwt
```

`register-clinic` y `patient-portal` son puntos de entrada publicos y hacen sus propias validaciones, rate limit y sesiones opacas. Las demas funciones verifican tambien el JWT y el perfil activo dentro de su codigo.

## 5. Publicar el frontend

```bash
npm ci
npm run test:ci
npm run build
```

Luego publique `dist/` con el flujo normal. El workflow de GitHub ejecuta el control de seguridad antes del build.

## 6. Pruebas de humo obligatorias

- Iniciar sesion como superadmin, administrador y usuario clinico.
- Confirmar que una clinica no puede consultar ni escribir datos de otra.
- Crear, desactivar y eliminar un usuario sin perder la sesion del administrador.
- Crear una clinica y confirmar tenant, usuario Auth, perfil, sede y consultorio.
- Abrir una foto de paciente y un RX antiguo y nuevo mediante URL firmada.
- Probar portal de paciente: acceso, consulta, solicitud de cita y cierre de sesion.
- Configurar/probar Gemini y Factus sin que las credenciales regresen al navegador.
- Consultar estado y enviar un mensaje de prueba por WhatsApp.
- Configurar un horario del profesional y otro del consultorio con intersección parcial; confirmar que solo se permita reservar dentro de la intersección.
- Confirmar que no se pueda reservar si falta el horario del profesional o del consultorio.
- Crear un bloqueo para el profesional y otro para el consultorio; confirmar que ambos impidan la cita.
- Intentar dos citas simultáneas para el mismo profesional y para el mismo consultorio; la segunda debe ser rechazada incluso desde dos sesiones concurrentes.
- Reprogramar una cita y confirmar que ella misma no sea detectada como conflicto, pero sí cualquier otra cita solapada.
- Revisar logs de las Edge Functions y errores RLS durante la prueba.

## 7. Verificaciones posteriores

- Inspeccionar Network y confirmar que no aparecen service keys, claves Gemini, credenciales Factus ni tokens de Meta.
- Confirmar que el bucket `adjuntos` figura como privado.
- Confirmar que `tenant_secrets`, `patient_portal_sessions`, `registration_attempts` y `outbound_message_log` no son legibles por `anon` ni `authenticated`.
- Ejecutar un audit de dependencias con acceso actualizado al registro: `npm audit`.
