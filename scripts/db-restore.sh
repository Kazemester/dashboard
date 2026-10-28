#!/usr/bin/env bash
# Load a dump made by db-backup.sh into this machine's database (replaces what is there).
# Run it before starting the app on a new machine, or stop the app first: docker compose stop app
set -euo pipefail
cd "$(dirname "$0")/.."
file="${1:-nexus-backup.sql}"
[ -f "$file" ] || { echo "File not found: $file"; exit 1; }
docker compose up -d db
until docker compose exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -q'; do sleep 1; done
docker compose exec -T db sh -c 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$file" > /dev/null
echo "Restored $file"
