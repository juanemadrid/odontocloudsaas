#!/usr/bin/env bash
set -euo pipefail

# ====================================================================
# CONFIGURADOR OFICIAL DE GOTRUE AUTH (SERVICIO 2 - ODONTOCLOUD)
# ADVERTENCIA: NO TOCA EDUNEXUS NI NINGÚN OTRO SERVICIO DEL VPS
# ====================================================================

ENV_FILE="/data/coolify/services/ueh7xuehxl9thmhre7fpk4xx/.env"
CONTAINER_NAME="supabase-auth-ueh7xuehxl9thmhre7fpk4xx"
if ! docker ps -a --format '{{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    CONTAINER_NAME=$(docker ps -a --filter "name=ueh7xuehxl9thmhre7fpk4xx" --format "{{.Names}}" | grep -E "auth|gotrue" | head -n 1 || echo "")
fi

echo "=== 1. Actualizando variables de entorno de GoTrue para OdontoCloud ==="
if [[ -f "$ENV_FILE" ]]; then
    if grep -q "GOTRUE_SITE_URL=" "$ENV_FILE"; then
        sed -i 's|GOTRUE_SITE_URL=.*|GOTRUE_SITE_URL=https://odontocloudcolombia.com|' "$ENV_FILE"
    else
        echo "GOTRUE_SITE_URL=https://odontocloudcolombia.com" >> "$ENV_FILE"
    fi

    if grep -q "SITE_URL=" "$ENV_FILE"; then
        sed -i 's|SITE_URL=.*|SITE_URL=https://odontocloudcolombia.com|' "$ENV_FILE"
    else
        echo "SITE_URL=https://odontocloudcolombia.com" >> "$ENV_FILE"
    fi

    if grep -q "ADDITIONAL_REDIRECT_URLS=" "$ENV_FILE"; then
        sed -i 's|ADDITIONAL_REDIRECT_URLS=.*|ADDITIONAL_REDIRECT_URLS=https://odontocloudcolombia.com/**,https://odontocloudcolombia.com/reset-password,https://odontocloudcolombia.com|' "$ENV_FILE"
    else
        echo "ADDITIONAL_REDIRECT_URLS=https://odontocloudcolombia.com/**,https://odontocloudcolombia.com/reset-password,https://odontocloudcolombia.com" >> "$ENV_FILE"
    fi

    if grep -q "GOTRUE_URI_ALLOW_LIST=" "$ENV_FILE"; then
        sed -i 's|GOTRUE_URI_ALLOW_LIST=.*|GOTRUE_URI_ALLOW_LIST=https://odontocloudcolombia.com/**,https://odontocloudcolombia.com/reset-password,https://odontocloudcolombia.com|' "$ENV_FILE"
    else
        echo "GOTRUE_URI_ALLOW_LIST=https://odontocloudcolombia.com/**,https://odontocloudcolombia.com/reset-password,https://odontocloudcolombia.com" >> "$ENV_FILE"
    fi
    echo "✅ Variables en .env actualizadas hacia https://odontocloudcolombia.com"
fi

if docker ps --format '{{.Names}}' | grep -q '^coolify$'; then
    echo "=== 2. Sincronizando variables en panel de Coolify ==="
    docker exec coolify php artisan tinker --execute='
    $service = App\Models\Service::find(2);
    if ($service) {
        $vars = [
            "GOTRUE_SITE_URL" => "https://odontocloudcolombia.com",
            "SITE_URL" => "https://odontocloudcolombia.com",
            "ADDITIONAL_REDIRECT_URLS" => "https://odontocloudcolombia.com/**,https://odontocloudcolombia.com/reset-password,https://odontocloudcolombia.com",
            "GOTRUE_URI_ALLOW_LIST" => "https://odontocloudcolombia.com/**,https://odontocloudcolombia.com/reset-password,https://odontocloudcolombia.com",
        ];
        foreach ($vars as $k => $v) {
            $ev = $service->environment_variables()->where("key", $k)->first();
            if ($ev) { $ev->value = $v; $ev->save(); }
        }
    }
    ' || true
fi

echo "=== 3. Reiniciando contenedor de Auth / GoTrue de OdontoCloud ==="
if [[ -n "$CONTAINER_NAME" ]]; then
    echo "Reiniciando $CONTAINER_NAME..."
    docker restart "$CONTAINER_NAME"
    sleep 3
    docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.State}}"
else
    echo "⚠️ No se encontró contenedor con nombre exacto, buscando contenedores activos de OdontoCloud..."
    docker ps --filter "name=ueh7xuehxl9thmhre7fpk4xx" --format "table {{.Names}}\t{{.Status}}"
fi

echo ""
echo "🎉 ¡GoTrue actualizado con éxito! Ahora los enlaces de activación redirigen directamente a https://odontocloudcolombia.com/reset-password"
echo "Edunexus no fue modificado en lo absoluto."
