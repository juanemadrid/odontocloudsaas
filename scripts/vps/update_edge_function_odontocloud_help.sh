#!/usr/bin/env bash
set -euo pipefail

# ====================================================================
# ACTUALIZADOR EXCLUSIVO DE ODONTOCLOUD-HELP CON OLLAMA (SERVICIO 2)
# ADVERTENCIA: NO TOCA EDUNEXUS NI NINGÚN OTRO SERVICIO DEL VPS
# ====================================================================

TARGET_DIR="/data/coolify/services/ueh7xuehxl9thmhre7fpk4xx/volumes/functions"
CONTAINER_NAME="supabase-edge-functions-ueh7xuehxl9thmhre7fpk4xx"
BASE_URL="https://raw.githubusercontent.com/juanemadrid/odontocloudsaas/main/supabase/functions"

echo "=== 1. Creando directorios requeridos en OdontoCloud ==="
mkdir -p "$TARGET_DIR/_shared"
mkdir -p "$TARGET_DIR/odontocloud-help"

echo "=== 2. Descargando base de conocimiento ampliada (planes, precios, DIAN/RIPS) ==="
curl -sSL "$BASE_URL/_shared/helpKnowledge.mjs" -o "$TARGET_DIR/_shared/helpKnowledge.mjs"

echo "=== 3. Descargando handler con soporte público y ChatGPT style ==="
curl -sSL "$BASE_URL/odontocloud-help/handler.mjs" -o "$TARGET_DIR/odontocloud-help/handler.mjs"
curl -sSL "$BASE_URL/odontocloud-help/index.ts" -o "$TARGET_DIR/odontocloud-help/index.ts"

echo "=== 4. Reiniciando contenedor de Edge Functions de OdontoCloud ==="
docker restart "$CONTAINER_NAME"

sleep 3
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.State}}"

echo ""
echo "🎉 ¡Completado! odontocloud-help actualizado con conocimiento comercial, público y Ollama."
echo "Edunexus no fue modificado en lo absoluto."
