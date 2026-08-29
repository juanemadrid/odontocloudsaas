#!/usr/bin/env bash
set -euo pipefail

service_uuid='ueh7xuehxl9thmhre7fpk4xx'
service_root="/data/coolify/services/${service_uuid}"
backup_root='/data/backups/odontocloud-daily'
database_container="supabase-db-${service_uuid}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="${backup_root}/odontocloud-${timestamp}.tgz"
partial="${archive}.partial"
staging_dir="$(mktemp -d /tmp/odontocloud-backup.XXXXXXXX)"

cleanup() {
  if [[ -n "${staging_dir:-}" && "$staging_dir" == /tmp/odontocloud-backup.* && -d "$staging_dir" ]]; then
    rm -rf -- "$staging_dir"
  fi
  if [[ -n "${partial:-}" && "$partial" == "${backup_root}/odontocloud-"*.tgz.partial ]]; then
    rm -f -- "$partial"
  fi
}
trap cleanup EXIT

install -d -m 700 "$backup_root"

docker exec "$database_container" pg_dump \
  -U postgres \
  -d postgres \
  -Fc > "${staging_dir}/database.dump"

docker exec "$database_container" pg_dumpall \
  -U postgres \
  --roles-only > "${staging_dir}/roles.sql"

tar -czf "${staging_dir}/storage.tgz" \
  -C "${service_root}/volumes/storage" .

tar -czf "${staging_dir}/service-config.tgz" \
  --exclude='./volumes/storage' \
  -C "$service_root" .

(
  cd "$staging_dir"
  sha256sum database.dump roles.sql storage.tgz service-config.tgz > SHA256SUMS
)

tar -czf "$partial" -C "$staging_dir" .
tar -tzf "$partial" >/dev/null
chmod 600 "$partial"
mv "$partial" "$archive"
sha256sum "$archive" > "${archive}.sha256"
chmod 600 "${archive}.sha256"

find "$backup_root" -maxdepth 1 -type f \
  \( -name 'odontocloud-*.tgz' -o -name 'odontocloud-*.tgz.sha256' \) \
  -mtime +14 -delete

printf 'OdontoCloud backup verified: %s\n' "$archive"
