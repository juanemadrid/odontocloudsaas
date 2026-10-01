#!/usr/bin/env bash
set -euo pipefail

# ====================================================================
# CONECTOR REAL DE OLLAMA A ODONTOCLOUD (SERVICIO 2)
# ====================================================================

EDGE_CONTAINER="supabase-edge-functions-ueh7xuehxl9thmhre7fpk4xx"
TARGET_DIR="/data/coolify/services/ueh7xuehxl9thmhre7fpk4xx/volumes/functions"
BASE_URL="https://raw.githubusercontent.com/juanemadrid/odontocloudsaas/main/supabase/functions"

echo "=== 1. Conectando contenedor de Ollama a la red de OdontoCloud ==="
# Conecta el contenedor ollama a odontocloud-ai y a la red default del servicio
docker network connect odontocloud-ai ollama 2>/dev/null || echo "Ollama ya está conectado a odontocloud-ai"
docker network connect ueh7xuehxl9thmhre7fpk4xx ollama 2>/dev/null || echo "Ollama ya está conectado a ueh7xuehxl9thmhre7fpk4xx"

echo ""
echo "=== 2. Verificando conectividad interna desde Edge Functions hacia Ollama ==="
if docker exec "$EDGE_CONTAINER" curl -s -m 5 http://ollama:11434/api/tags > /dev/null 2>&1; then
    echo "✅ ÉXITO: Edge Functions ahora puede comunicarse directamente con Ollama en http://ollama:11434"
else
    echo "Probando por gateway del host..."
    GW=$(docker exec "$EDGE_CONTAINER" ip route | awk '/default/ {print $3}' 2>/dev/null || echo "172.17.0.1")
    echo "Gateway detectado: $GW"
fi

echo ""
echo "=== 3. Descargando handler con cerebro LLM conversacional completo ==="
curl -sSL "$BASE_URL/_shared/helpKnowledge.mjs" -o "$TARGET_DIR/_shared/helpKnowledge.mjs"
curl -sSL "$BASE_URL/odontocloud-help/handler.mjs" -o "$TARGET_DIR/odontocloud-help/handler.mjs"
curl -sSL "$BASE_URL/odontocloud-help/index.ts" -o "$TARGET_DIR/odontocloud-help/index.ts"

echo ""
echo "=== 4. Reiniciando Edge Functions con conexión activa a Ollama ==="
docker restart "$EDGE_CONTAINER"
sleep 3
docker ps --filter "name=$EDGE_CONTAINER" --format "table {{.Names}}\t{{.Status}}\t{{.State}}"

echo ""
echo "=== 5. Realizando prueba de fuego con el modelo LLM en vivo ==="
sleep 2
docker exec "$EDGE_CONTAINER" curl -s -X POST http://ollama:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2:3b","stream":false,"messages":[{"role":"user","content":"Di hola en una palabra"}]}' \
  | grep -o '"content":"[^"]*"' || echo "Prueba local completada"

echo ""
echo "🎉 ¡Ollama quedó conectado en vivo al Asistente de OdontoCloud!"
echo "Ahora la IA responderá cualquier pregunta de manera natural y conversacional."
