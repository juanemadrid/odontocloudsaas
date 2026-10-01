#!/usr/bin/env bash
set -euo pipefail

# ====================================================================
# APLICAR MIGRACIÓN EMAIL_LOGS EXCLUSIVAMENTE A ODONTOCLOUD (SERVICIO 2)
# ADVERTENCIA: NO TOCA EDUNEXUS NI NINGÚN OTRO SERVICIO DEL VPS
# ====================================================================

DB_CONTAINER="supabase-db-ueh7xuehxl9thmhre7fpk4xx"
SQL_URL="https://raw.githubusercontent.com/juanemadrid/odontocloudsaas/main/supabase/migrations/20261001_create_email_logs.sql"

echo "=== 1. Descargando migración SQL ==="
curl -sSL "$SQL_URL" | docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres

echo "=== 2. Notificando a PostgREST para recargar el esquema ==="
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';" || true

echo "🎉 ¡Migración aplicada exitosamente! La tabla email_logs ya está activa en OdontoCloud."
