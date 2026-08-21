# Preparación para producción

Este documento separa lo que el repositorio puede garantizar de lo que debe activarse en servicios externos antes de atender una clínica real.

## Validación obligatoria

Antes de publicar:

```bash
npm ci
npm run test:ci
```

`test:ci` verifica seguridad estática, disponibilidad de agenda, los 24 módulos visibles de configuración, controles críticos de producción y la compilación de Vite. El flujo de GitHub Pages ubicado en `.github/workflows/deploy.yml` ejecuta exactamente esa validación y no publica si falla.

## Supabase

- Confirmar en el panel que RLS permanece activo en todas las tablas públicas.
- Revisar los asesores de seguridad y rendimiento después de cada migración.
- Activar MFA para todas las cuentas con acceso al panel de Supabase y para administradores de OdontoCloud.
- Configurar SMTP propio antes de invitar usuarios reales; el SMTP predeterminado no es una solución de producción.
- Restringir la red de la base de datos cuando el plan y la arquitectura lo permitan.
- Vigilar semanalmente Database Size, Storage Size, Cached/Uncached Egress, MAU y Edge Function Invocations.
- Definir alertas internas al 70 %, 85 % y 95 % de cada cuota.

## Factus

- El ambiente actual debe conservarse en pruebas hasta recibir credenciales, numeración y resolución de producción.
- Ejecutar una factura de valor controlado, consultar su estado, descargar el PDF y comprobar CUFE/QR con autorización expresa del responsable de la clínica.
- Probar nota crédito y contingencia antes del corte definitivo.
- Nunca copiar secretos Factus al frontend, archivos `.env` versionados ni registros de auditoría.

## WhatsApp

- Verificar token, identificador de teléfono, versión de Graph API y plantillas aprobadas.
- Enviar un mensaje a un número de prueba autorizado y comprobar `WHATSAPP_SENT` en el reporte.
- Confirmar que el reporte solo conserva hash del destinatario y no el contenido clínico.

## Archivos clínicos

- Las imágenes se optimizan antes de subir y los archivos privados se guardan mediante referencias estables; las URLs firmadas son temporales.
- Probar carga, descarga y reapertura tras cerrar sesión con imagen, PDF y documento clínico representativos.
- No almacenar archivos clínicos en buckets públicos.

## Criterio de salida

La salida se aprueba solamente cuando pasan `npm run test:ci`, una prueba autenticada de los flujos principales, el ensayo Factus autorizado y un ejercicio de restauración de respaldo. Una compilación exitosa por sí sola no equivale a aprobación clínica ni contable.
