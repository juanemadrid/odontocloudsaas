#!/usr/bin/env bash
# Execute on the Coolify host; only OdontoCloud's existing functions volume.
set -Eeuo pipefail
REVISION="${1:-}"
[[ "$REVISION" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected published 40-character commit.'; exit 1; }
SERVICE='ueh7xuehxl9thmhre7fpk4xx'
EDGE="supabase-edge-functions-$SERVICE"
ROOT="/data/coolify/services/$SERVICE/volumes/functions"
[[ -d "$ROOT" && "$(realpath "$ROOT")" == "$ROOT" ]] || { echo 'Unexpected OdontoCloud directory.'; exit 1; }
[[ "$(docker inspect --format '{{.Name}}' "$EDGE")" == "/$EDGE" ]] || exit 1
[[ "$(docker inspect --format '{{.State.Running}}' "$EDGE")" == 'true' ]] || exit 1
MOUNT="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}' "$EDGE")"
[[ "$MOUNT" == "$ROOT" && -f "$ROOT/factus-proxy/index.ts" ]] || { echo 'Unexpected functions volume; no changes.'; exit 1; }
exec 9>/tmp/odontocloud-factus-recovery.lock
flock -n 9 || { echo 'Another Factus update is running.'; exit 1; }
STAGE="$(mktemp /tmp/odontocloud-factus.XXXXXXXX.ts)"
trap 'rm -f -- "$STAGE"' EXIT
curl --fail --silent --show-error --location --max-time 40 "https://raw.githubusercontent.com/juanemadrid/odontocloudsaas/$REVISION/supabase/functions/factus-proxy/index.ts" -o "$STAGE"
[[ -s "$STAGE" ]] || exit 1
BACKUP="$ROOT/factus-proxy/index.ts.backup-$(date -u +%Y%m%dT%H%M%SZ)"
cp -- "$ROOT/factus-proxy/index.ts" "$BACKUP"
cp -- "$STAGE" "$ROOT/factus-proxy/index.ts.next"
mv -- "$ROOT/factus-proxy/index.ts.next" "$ROOT/factus-proxy/index.ts"
if ! docker restart "$EDGE"; then
  cp -- "$BACKUP" "$ROOT/factus-proxy/index.ts"
  docker restart "$EDGE" || true
  exit 1
fi
echo "OdontoCloud factus-proxy updated to $REVISION. Backup: $BACKUP"
