#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Verificando contenedores de Ollama en el VPS ==="
docker ps --filter "name=ollama" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || true

echo ""
echo "=== 2. Verificando conectividad local a Ollama en el host (puerto 11434) ==="
if curl -s -m 3 http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama está respondiendo en http://localhost:11434"
    echo "Modelos instalados en Ollama:"
    curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' || true
elif curl -s -m 3 http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama está respondiendo en http://127.0.0.1:11434"
    curl -s http://127.0.0.1:11434/api/tags | grep -o '"name":"[^"]*"' || true
else
    echo "⚠️ Ollama no respondió en localhost:11434 directamente."
fi

echo ""
echo "=== 3. Variables de Ollama dentro de Edge Functions de OdontoCloud ==="
CONTAINER="supabase-edge-functions-ueh7xuehxl9thmhre7fpk4xx"
docker exec "$CONTAINER" env | grep -E "OLLAMA|ODONTO_HELP" || echo "No hay variables de OLLAMA en el contenedor de Edge Functions."

echo ""
echo "=== 4. Redes Docker del servicio OdontoCloud ==="
docker inspect "$CONTAINER" --format '{{json .NetworkSettings.Networks}}' || true
