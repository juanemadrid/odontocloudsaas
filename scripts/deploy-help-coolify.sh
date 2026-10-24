#!/usr/bin/env bash
# Run on the VPS, in the Coolify host terminal. OdontoCloud service only.
set -Eeuo pipefail
REVISION="${1:-}"
[[ "$REVISION" =~ ^[0-9a-f]{40}$ ]] || { echo 'Usage: bash deploy-help-coolify.sh <published-40-character-commit>'; exit 1; }
SERVICE='ueh7xuehxl9thmhre7fpk4xx'
EDGE="supabase-edge-functions-$SERVICE"
DB="supabase-db-$SERVICE"
ROOT="/data/coolify/services/$SERVICE/volumes/functions"
BASE="https://raw.githubusercontent.com/juanemadrid/odontocloudsaas/$REVISION"
FILES=(
  odontocloud-help/index.ts odontocloud-help/auth.mjs odontocloud-help/handler.mjs
  odontocloud-help/managedHelp.mjs odontocloud-help/credentialStore.mjs
  odontocloud-help-settings/index.ts odontocloud-help-settings/auth.mjs odontocloud-help-settings/handler.mjs
  _shared/helpKnowledge.mjs _shared/helpConversation.mjs tenant-secrets/crypto.ts
)
MIGRATIONS=(20261024142001_odontocloud_help_controls.sql 20261024145608_odontocloud_help_credentials.sql)
for cmd in docker curl flock realpath; do command -v "$cmd" >/dev/null || { echo "Missing command: $cmd"; exit 1; }; done
exec 9>/tmp/odontocloud-help-deploy.lock
flock -n 9 || { echo 'Another OdontoCloud help deployment is running.'; exit 1; }
[[ -d "$ROOT" && "$(realpath "$ROOT")" == "$ROOT" ]] || { echo 'Unexpected OdontoCloud functions path; no changes.'; exit 1; }
for container in "$EDGE" "$DB"; do
  [[ "$(docker inspect --format '{{.Name}}' "$container")" == "/$container" ]] || exit 1
  [[ "$(docker inspect --format '{{.State.Running}}' "$container")" == 'true' ]] || { echo "$container is not running; no changes."; exit 1; }
done
MOUNT="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}' "$EDGE")"
[[ "$MOUNT" == "$ROOT" ]] || { echo 'Functions mount does not match OdontoCloud; no changes.'; exit 1; }
if ! docker exec "$EDGE" sh -c 'test -n "${TENANT_SECRETS_MASTER_KEY_V1:-}${TENANT_SECRETS_MASTER_KEY:-}"'; then
  echo 'OdontoCloud functions need their existing encryption master key configured in Coolify first. Do not overwrite any existing master key.'
  exit 1
fi
sql() { docker exec -i "$DB" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
sql -tAc "SELECT CASE WHEN to_regclass('public.profiles') IS NOT NULL AND to_regclass('public.tenants') IS NOT NULL THEN 1 ELSE 0 END" | grep -qx 1
STAGE="$(mktemp -d /tmp/odonto-help.XXXXXXXX)"
trap 'case "$STAGE" in /tmp/odonto-help.*) rm -rf -- "$STAGE";; esac' EXIT
for file in "${FILES[@]}"; do
  mkdir -p "$STAGE/functions/$(dirname "$file")"
  curl --fail --silent --show-error --location --max-time 40 "$BASE/supabase/functions/$file" -o "$STAGE/functions/$file"
  [[ -s "$STAGE/functions/$file" ]] || exit 1
done
for migration in "${MIGRATIONS[@]}"; do
  curl --fail --silent --show-error --location --max-time 40 "$BASE/supabase/migrations/$migration" -o "$STAGE/$migration"
done
BACKUP="/data/coolify/services/$SERVICE/help-backups/$(date -u +%Y%m%dT%H%M%SZ)-${REVISION:0:12}"
mkdir -p "$BACKUP/functions"
chmod 700 "$BACKUP"
for file in "${FILES[@]}"; do
  if [[ -f "$ROOT/$file" ]]; then
    mkdir -p "$BACKUP/functions/$(dirname "$file")"
    cp -p -- "$ROOT/$file" "$BACKUP/functions/$file"
  fi
done
docker exec "$DB" pg_dump -U postgres -d postgres --schema-only > "$BACKUP/schema-before.sql"
chmod 600 "$BACKUP/schema-before.sql"
install_migration() {
  local index="$1" query="$2" expected="$3" count
  count="$(sql -tAc "$query")"
  if [[ "$count" == '0' ]]; then
    sql < "$STAGE/${MIGRATIONS[$index]}"
  elif [[ "$count" == "$expected" ]]; then
    echo "Migration objects already present: ${MIGRATIONS[$index]} (preserving data)."
  else
    echo "Partial or unexpected migration state; stopping: ${MIGRATIONS[$index]}"; exit 1
  fi
}
install_migration 0 "SELECT (to_regclass('public.odonto_help_global') IS NOT NULL)::int + (to_regclass('public.odonto_help_clinics') IS NOT NULL)::int + (to_regclass('public.odonto_help_usage') IS NOT NULL)::int + (to_regprocedure('public.reserve_odonto_help_request(uuid,uuid)') IS NOT NULL)::int" 4
install_migration 1 "SELECT (to_regclass('public.odonto_help_credentials') IS NOT NULL)::int + (to_regclass('public.odonto_help_key_checks') IS NOT NULL)::int + (to_regprocedure('public.reserve_odonto_help_key_check(uuid)') IS NOT NULL)::int" 3
# Do not enable any clinic during installation. New tables default to disabled.
for file in "${FILES[@]}"; do
  mkdir -p "$ROOT/$(dirname "$file")"
  cp -- "$STAGE/functions/$file" "$ROOT/$file"
done
docker restart "$EDGE" >/dev/null
sleep 3
[[ "$(docker inspect --format '{{.State.Running}}' "$EDGE")" == 'true' ]] || {
  echo "Functions runtime did not stay running. Restore the previous files from $BACKUP/functions and restart only $EDGE."; exit 1;
}
echo "OdontoCloud help backend installed from $REVISION. Backup: $BACKUP"
echo 'Now test Help AI settings in the superadmin panel, save the dedicated API key, then enable the desired clinic.'
