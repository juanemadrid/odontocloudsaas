#!/usr/bin/env bash
# Apply only to the verified OdontoCloud database. No service restarts.
set -Eeuo pipefail
REVISION="${1:-}"
[[ "$REVISION" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected published 40-character commit.'; exit 1; }
SERVICE='ueh7xuehxl9thmhre7fpk4xx'
DB="supabase-db-$SERVICE"
ROOT="/data/coolify/services/$SERVICE"
[[ -d "$ROOT" && "$(realpath "$ROOT")" == "$ROOT" ]] || exit 1
[[ "$(docker inspect --format '{{.Name}}' "$DB")" == "/$DB" ]] || exit 1
[[ "$(docker inspect --format '{{.State.Running}}' "$DB")" == 'true' ]] || exit 1
exec 9>/tmp/odontocloud-credit-note-schema.lock
flock -n 9 || { echo 'Another OdontoCloud schema repair is running.'; exit 1; }
STAGE="$(mktemp /tmp/odontocloud-credit-schema.XXXXXXXX.sql)"
trap 'rm -f -- "$STAGE"' EXIT
curl --fail --silent --show-error --location --max-time 40 "https://raw.githubusercontent.com/juanemadrid/odontocloudsaas/$REVISION/scripts/sql/repair-credit-note-schema.sql" -o "$STAGE"
BACKUP="$ROOT/billing-backups/$(date -u +%Y%m%dT%H%M%SZ)-${REVISION:0:12}"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
docker exec "$DB" pg_dump -U postgres -d postgres --table=public.notas_credito > "$BACKUP/notas_credito.sql"
chmod 600 "$BACKUP/notas_credito.sql"
docker exec -i "$DB" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < "$STAGE"
docker exec "$DB" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SELECT 'public.get_factura_credited_balance(uuid,uuid)'::regprocedure AS installed;"
echo "OdontoCloud credit note schema installed. Backup: $BACKUP"
