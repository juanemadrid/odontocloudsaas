# Recuperación y respaldos

El plan gratuito de Supabase no ofrece respaldos descargables automáticos. Para información clínica se necesita una copia cifrada fuera de Supabase y una restauración ensayada.

## Frecuencia mínima

- Base de datos: copia diaria mientras exista operación clínica.
- Storage: sincronización diaria de objetos nuevos o modificados.
- Antes de cada despliegue con migraciones: copia adicional de base de datos.
- Prueba de restauración: mensual, en un entorno aislado y sin enviar mensajes ni documentos electrónicos.

## Copia de base de datos

Ejecutar desde una máquina controlada con Supabase CLI y una URL de conexión guardada en un gestor de secretos:

```bash
supabase db dump --db-url "$SUPABASE_DB_URL" --file schema.sql
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only --use-copy --file data.sql
```

Cifrar ambos archivos antes de moverlos al repositorio de respaldo. No subirlos a Git, GitHub Actions ni almacenamiento público. Registrar fecha, tamaño, checksum y responsable.

## Storage

Mantener un inventario con bucket, ruta, tamaño, checksum y fecha. Descargar con credenciales de servicio únicamente desde un proceso backend controlado, cifrar el resultado y comprobar una muestra de archivos después de cada copia.

## Restauración

1. Crear un proyecto o base aislada de recuperación.
2. Restaurar primero el esquema y luego los datos.
3. Restaurar los objetos conservando bucket y ruta.
4. Ejecutar conteos por clínica y contrastarlos con el manifiesto del respaldo.
5. Probar inicio de sesión, paciente, agenda, documento clínico, configuración, caja y reportes.
6. Mantener deshabilitados Factus, WhatsApp y correos durante el ensayo.
7. Documentar tiempo real de recuperación y cualquier diferencia.

## Incidente y reversión

- Detener publicaciones y escrituras afectadas sin borrar evidencia.
- Guardar logs sanitizados y el identificador del despliegue.
- Revertir la aplicación al último artefacto validado.
- Las migraciones se corrigen con una migración nueva y revisada; no se usa `reset` destructivo sobre producción.
- Restaurar datos solo después de determinar el punto de recuperación y obtener autorización del responsable.
- Rotar cualquier secreto posiblemente expuesto y validar RLS antes de reabrir el servicio.
