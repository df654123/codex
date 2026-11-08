#!/usr/bin/env bash
# Copy a consistent stopped-server SQLite database snapshot.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env ]; then echo >&2 'No .env; refusing backup.'; exit 2; fi
backup_root="${1:-$HOME/class4-backups}"
mkdir -p "$backup_root"
chmod 700 "$backup_root"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
tmp="$(mktemp -d)"
chmod 700 "$tmp"
restart=0
finish() {
  if [ "$restart" = 1 ]; then docker compose --env-file .env -f compose.yaml start app >/dev/null || true; fi
  rm -rf "$tmp"
}
trap finish EXIT
docker compose --env-file .env -f compose.yaml stop app
restart=1
cid="$(docker compose --env-file .env -f compose.yaml ps -a -q app)"
if [ -z "$cid" ]; then echo >&2 'Container not found; no backup performed'; exit 3; fi
mkdir "$tmp/data"
docker cp "$cid:/app/data/." "$tmp/data/"
if ! find "$tmp/data" -type f -print -quit | grep -q .; then echo >&2 'No database files, refusing empty backup'; exit 4; fi
archive="$backup_root/class4-$stamp.tar.gz"
tar -czf "$archive" -C "$tmp" data
chmod 600 "$archive"
sha256sum "$archive" > "$archive.sha256"
chmod 600 "$archive.sha256"
echo "Created locally protected backup: $archive"
echo 'Keep backups in a separately protected location. This is not an offsite backup.'
