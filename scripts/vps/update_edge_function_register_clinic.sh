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

echo "=== 2. Descargando la versión actualizada de register-clinic desde GitHub ==="
curl -sSL "$RAW_URL" -o "$TARGET_DIR/index.ts"

if [[ -s "$TARGET_DIR/index.ts" ]]; then
    FILE_SIZE=$(wc -c < "$TARGET_DIR/index.ts")
    echo "✅ Archivo descargado exitosamente ($FILE_SIZE bytes)."
else
    echo "❌ Error: No se pudo descargar el archivo index.ts." >&2
    exit 1
fi

echo "=== 3. Reiniciando contenedor de Edge Functions de OdontoCloud ==="
docker restart "$CONTAINER_NAME"

echo "=== 4. Verificando estado del contenedor ==="
sleep 3
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.State}}"

echo ""
echo "🎉 ¡Completado exitosamente! La función register-clinic quedó actualizada y lista para enviar correos con Resend."
echo "Edunexus no fue modificado en lo absoluto."
