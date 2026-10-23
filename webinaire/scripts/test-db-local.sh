#!/usr/bin/env bash
# Lance un PostgreSQL jetable, applique les migrations puis les tests SQL (vitest).
# Sert quand Docker / `supabase start` n'est pas disponible.
# Avec Supabase local : DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DIR="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
cleanup() { "$PGBIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
RUN_AS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DIR"; RUN_AS=(runuser -u postgres --); fi
"${RUN_AS[@]}" "$PGBIN/initdb" -D "$DIR/data" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=127.0.0.1" -w start >/dev/null
URL="postgresql://postgres@127.0.0.1:$PORT/postgres"
psql "$URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/local-auth-stub.sql
for f in supabase/migrations/*.sql; do psql "$URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
echo "Migrations appliquées."
DATABASE_URL="$URL" npx vitest run tests/db.test.ts
