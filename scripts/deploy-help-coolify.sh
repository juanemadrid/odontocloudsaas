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
  _shared/helpKnowledge.mjs _shared/helpConversation.mjs _shared/helpCrypto.mjs _shared/helpApiKey.mjs tenant-secrets/crypto.ts
)
MIGRATIONS=(20261024142001_odontocloud_help_controls.sql 20261024145608_odontocloud_help_credentials.sql)
for cmd in docker curl flock realpath openssl; do command -v "$cmd" >/dev/null || { echo "Missing command: $cmd"; exit 1; }; done
exec 9>/tmp/odontocloud-help-deploy.lock
flock -n 9 || { echo 'Another OdontoCloud help deployment is running.'; exit 1; }
[[ -d "$ROOT" && "$(realpath "$ROOT")" == "$ROOT" ]] || { echo 'Unexpected OdontoCloud functions path; no changes.'; exit 1; }
for container in "$EDGE" "$DB"; do
  [[ "$(docker inspect --format '{{.Name}}' "$container")" == "/$container" ]] || exit 1
  [[ "$(docker inspect --format '{{.State.Running}}' "$container")" == 'true' ]] || { echo "$container is not running; no changes."; exit 1; }
done
MOUNT="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}' "$EDGE")"
[[ "$MOUNT" == "$ROOT" ]] || { echo 'Functions mount does not match OdontoCloud; no changes.'; exit 1; }
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
# Provision a dedicated persistent key without modifying existing tenant encryption.
# Never regenerate a missing key when it already protects a saved help credential.
SECRET_DIR="$ROOT/.odonto-help-secrets"
SECRET_FILE="$SECRET_DIR/master-key-v1"
[[ ! -L "$SECRET_DIR" && ! -L "$SECRET_FILE" ]] || { echo 'Unexpected secret symlink; stopping.'; exit 1; }
if ! docker exec "$EDGE" sh -c 'test -n "${ODONTO_HELP_MASTER_KEY_V1:-}"'; then
  if [[ ! -e "$SECRET_FILE" ]]; then
    protected="$(sql -tAc "SELECT EXISTS (SELECT 1 FROM public.odonto_help_credentials WHERE encrypted_key->>'kid' = 'help-v1')")"
    [[ "$protected" == 'f' ]] || { echo 'Existing help encryption key is missing. Restore it from backup; do not regenerate it.'; exit 1; }
    install -d -m 700 "$SECRET_DIR"
    (umask 077; set -o noclobber; openssl rand -base64 32 > "$SECRET_FILE")
    echo 'Prepared dedicated help encryption; existing tenant secrets unchanged.'
  fi
  [[ "$(openssl base64 -d -in "$SECRET_FILE" | wc -c | tr -d ' ')" == '32' ]] || { echo 'Invalid existing help master key; stopping without replacing it.'; exit 1; }
  runtime_uid="$(docker exec "$EDGE" id -u)"
  runtime_gid="$(docker exec "$EDGE" id -g)"
  [[ "$runtime_uid:$runtime_gid" =~ ^[0-9]+:[0-9]+$ ]] || exit 1
  chown "$runtime_uid:$runtime_gid" "$SECRET_DIR" "$SECRET_FILE"
  chmod 700 "$SECRET_DIR"
  chmod 600 "$SECRET_FILE"
  cp -p -- "$SECRET_FILE" "$BACKUP/help-master-key-v1"
  chmod 600 "$BACKUP/help-master-key-v1"
  docker exec "$EDGE" test -r /home/deno/functions/.odonto-help-secrets/master-key-v1
fi
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
verified=false
for attempt in 1 2 3; do
  if curl --silent --show-error --max-time 12 -D "$STAGE/endpoint-headers" -o /dev/null \
    'https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io/functions/v1/odontocloud-help-settings' && \
    grep -qi '^x-odonto-help-version: 2026-10-24-auth-keys-1' "$STAGE/endpoint-headers"; then
    verified=true; break
  fi
  sleep 2
done
if [[ "$verified" != true ]]; then
  echo 'Files installed, but the new settings endpoint could not be verified. Do not enable clinics yet; check the OdontoCloud functions runtime.'
  exit 1
fi
echo "OdontoCloud help backend installed from $REVISION. Backup: $BACKUP"
echo 'Settings endpoint version verified: 2026-10-24-auth-keys-1.'
echo 'Now test Help AI settings in the superadmin panel, save the dedicated API key, then enable the desired clinic.'
