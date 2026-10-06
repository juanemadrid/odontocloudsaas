#!/usr/bin/env bash
set -euo pipefail

# ====================================================================
# ACTUALIZADOR EXCLUSIVO DE LA EDGE FUNCTION REGISTER-CLINIC (ODONTOCLOUD)
# ADVERTENCIA: NO TOCA EDUNEXUS NI NINGÚN OTRO SERVICIO DEL VPS
# ====================================================================

TARGET_DIR="/data/coolify/services/ueh7xuehxl9thmhre7fpk4xx/volumes/functions/register-clinic"
CONTAINER_NAME="supabase-edge-functions-ueh7xuehxl9thmhre7fpk4xx"
RAW_URL="https://raw.githubusercontent.com/juanemadrid/odontocloudsaas/main/supabase/functions/register-clinic/index.ts"

echo "=== 1. Creando directorio de la función si no existe ==="
mkdir -p "$TARGET_DIR"
SHARED_DIR="/data/coolify/services/ueh7xuehxl9thmhre7fpk4xx/volumes/functions/_shared"
mkdir -p "$SHARED_DIR"

echo "=== 2. Descargando la versión actualizada de register-clinic desde GitHub ==="
curl -sSL "${RAW_URL}?ts=$(date +%s)" -o "$TARGET_DIR/index.ts"
curl -sSL "https://raw.githubusercontent.com/juanemadrid/odontocloudsaas/main/supabase/functions/_shared/resendEmail.ts?ts=$(date +%s)" -o "$SHARED_DIR/resendEmail.ts"

if [[ -s "$TARGET_DIR/index.ts" ]]; then
    FILE_SIZE=$(wc -c < "$TARGET_DIR/index.ts")
    echo "✅ Archivo descargado exitosamente ($FILE_SIZE bytes)."
else
    echo "❌ Error: No se pudo descargar el archivo index.ts." >&2
    exit 1
fi

echo "=== 3. Vinculando clave RESEND_API_KEY desde la configuración de OdontoCloud ==="
RESEND_KEY=""
GOTRUE_CONTAINER=$(docker ps --filter "name=supabase-gotrue-ueh7xuehxl9thmhre7fpk4xx" --format "{{.Names}}" | head -n 1)
if [[ -n "$GOTRUE_CONTAINER" ]]; then
    RESEND_KEY=$(docker inspect "$GOTRUE_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -E '^(GOTRUE_SMTP_PASS|SMTP_PASS)=re_' | head -n 1 | cut -d'=' -f2- || true)
fi

if [[ -z "$RESEND_KEY" && -f /tmp/odontocloud-resend-key.txt ]]; then
    RESEND_KEY=$(cat /tmp/odontocloud-resend-key.txt | tr -d '\r\n')
fi

if [[ -n "$RESEND_KEY" && "$RESEND_KEY" =~ ^re_ ]]; then
    echo "{\"resendApiKey\":\"$RESEND_KEY\"}" > "$TARGET_DIR/resend_config.json"
    echo "{\"resendApiKey\":\"$RESEND_KEY\"}" > "$SHARED_DIR/resend_config.json"
    chmod 600 "$TARGET_DIR/resend_config.json" "$SHARED_DIR/resend_config.json"
    echo "✅ Clave Resend ($RESEND_KEY) detectada y vinculada a la Edge Function."
else
    echo "ℹ️ Clave re_ no detectada automáticamente en GoTrue. Puedes configurarla ejecutando:"
    echo "   echo '{\"resendApiKey\":\"re_tu_clave\"}' > $TARGET_DIR/resend_config.json"
fi

echo "=== 4. Reiniciando contenedor de Edge Functions de OdontoCloud ==="
docker restart "$CONTAINER_NAME"

echo "=== 5. Verificando estado del contenedor ==="
sleep 3
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.State}}"

echo ""
echo "🎉 ¡Completado exitosamente! La función register-clinic quedó actualizada y lista para enviar correos con Resend."
echo "Edunexus no fue modificado en lo absoluto."
