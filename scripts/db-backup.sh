#!/usr/bin/env bash
# Dump the dashboard database (tiles, settings, items, chat…) into one SQL file. Run from the project folder.
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:-nexus-backup.sql}"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' > "$out"
echo "Saved $(wc -c < "$out" | tr -d ' ') bytes to $out"
