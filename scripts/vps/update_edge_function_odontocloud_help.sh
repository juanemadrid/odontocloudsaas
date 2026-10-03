#!/usr/bin/env bash
set -euo pipefail
# Ejecutar con el SHA completo de un commit publicado, no con una rama mutable.
REVISION="${1:-}"
[[ "$REVISION" =~ ^[0-9a-f]{40}$ ]] || { echo 'Uso: bash update_edge_function_odontocloud_help.sh <SHA de commit publicado>'; exit 1; }
TARGET_DIR='/data/coolify/services/ueh7xuehxl9thmhre7fpk4xx/volumes/functions'
CONTAINER_NAME='supabase-edge-functions-ueh7xuehxl9thmhre7fpk4xx'
ACTUAL=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/home/deno/functions"}}{{.Source}}{{end}}{{end}}' "$CONTAINER_NAME")
[[ "$ACTUAL" == "$TARGET_DIR" && -d "$TARGET_DIR" ]] || { echo 'Volumen inesperado. Sin cambios.'; exit 1; }
TMP=$(mktemp -d /tmp/odontocloud-help.XXXXXX)
trap 'rm -rf "$TMP"' EXIT
FILES=(odontocloud-help/index.ts odontocloud-help/handler.mjs odontocloud-help/auth.mjs _shared/helpKnowledge.mjs _shared/helpConversation.mjs)
BASE_URL="https://raw.githubusercontent.com/juanemadrid/odontocloudsaas/$REVISION/supabase/functions"
for FILE in "${FILES[@]}"; do
  [[ ! -L "$TARGET_DIR/$FILE" && ! -L "$TARGET_DIR/$(dirname "$FILE")" ]] || { echo 'Enlace inesperado. Sin cambios.'; exit 1; }
  mkdir -p "$TMP/$(dirname "$FILE")"
  curl --fail --silent --show-error --location --max-time 30 "$BASE_URL/$FILE" -o "$TMP/$FILE"
  [[ -s "$TMP/$FILE" ]] || { echo 'Descarga vacía. Sin cambios.'; exit 1; }
done
(cd "$TMP" && sha256sum "${FILES[@]}" > files.sha256)
BACKUP=$(mktemp -d /root/odontocloud-help-backup.XXXXXX)
for FILE in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$FILE")"
  if [[ -e "$TARGET_DIR/$FILE" ]]; then cp -a "$TARGET_DIR/$FILE" "$BACKUP/$FILE"; else printf '%s\n' "$FILE" >> "$BACKUP/new-files.txt"; fi
done
for FILE in "${FILES[@]}"; do
  mkdir -p "$TARGET_DIR/$(dirname "$FILE")"
  cp "$TMP/$FILE" "$TARGET_DIR/$FILE"
  chmod 644 "$TARGET_DIR/$FILE"
done
(cd "$TARGET_DIR" && sha256sum -c "$TMP/files.sha256")
printf 'Archivos instalados desde %s. Respaldo: %s\n' "$REVISION" "$BACKUP"
printf 'Para activarlos: docker restart %s\n' "$CONTAINER_NAME"
echo 'No se modificaron redes, Ollama ni Edunexus. Falta comprobar una respuesta real desde la aplicación.'
