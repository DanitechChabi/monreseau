#!/usr/bin/env bash
# Déploie la base et les Edge Functions via l'API de gestion Supabase
# (sans la CLI `supabase`). Idempotent : seules les migrations absentes de
# supabase_migrations.schema_migrations sont appliquées.
#
#   SUPABASE_ACCESS_TOKEN=sbp_… SUPABASE_PROJECT_REF=xxxx bash scripts/deploy-supabase.sh [migrations|functions|all]
#
# Le jeton n'est jamais écrit sur disque ni affiché.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN manquant}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF manquant}"
API="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF"
AUTH=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
WHAT="${1:-all}"

sql() { # exécute du SQL, affiche la réponse JSON
  python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' |
    curl -sS --fail-with-body -m 180 -X POST "${AUTH[@]}" -H "Content-Type: application/json" --data @- "$API/database/query"
}

migrations() {
  local applied
  applied=$(echo "create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
    select coalesce(json_agg(version), '[]') as v from supabase_migrations.schema_migrations;" | sql)
  for f in supabase/migrations/*.sql; do
    local base version name
    base=$(basename "$f" .sql); version=${base%%_*}; name=${base#*_}
    if grep -q "\"$version\"" <<<"$applied"; then echo "migration $version : déjà appliquée"; continue; fi
    python3 - "$f" "$version" "$name" <<'PY' | sql >/dev/null
import sys
path, version, name = sys.argv[1:]
body = open(path).read()
assert "$mig$" not in body
print(f"""begin;
{body}
insert into supabase_migrations.schema_migrations (version, statements, name)
values ('{version}', array[$mig${body}$mig$], '{name}');
commit;""")
PY
    echo "migration $version : appliquée"
  done
}

# slug:verify_jwt (doit correspondre à supabase/config.toml)
FUNCTIONS="register:false resend-confirmation:false confirm:false admin-login:false admin-resend:true admin-announce:true purge-expired:false admin-attendance:true admin-certificates:true verify-certificate:false"

functions() {
  cd supabase/functions
  local shared=()
  while IFS= read -r f; do shared+=(-F "file=@$f;filename=$f"); done < <(find _shared -name '*.ts' | sort)
  for item in $FUNCTIONS; do
    local slug=${item%%:*} verify=${item##*:}
    curl -sS --fail-with-body -m 300 -X POST "${AUTH[@]}" \
      -F "metadata={\"entrypoint_path\":\"$slug/index.ts\",\"import_map_path\":\"import_map.json\",\"name\":\"$slug\",\"verify_jwt\":$verify};type=application/json" \
      -F "file=@$slug/index.ts;filename=$slug/index.ts" -F "file=@import_map.json;filename=import_map.json" "${shared[@]}" \
      "$API/functions/deploy?slug=$slug" |
      python3 -c 'import json,sys; d=json.load(sys.stdin); print("fonction %s : %s (version %s, verify_jwt=%s)" % (d["slug"], d["status"], d["version"], d["verify_jwt"]))'
  done
  cd - >/dev/null
}

case "$WHAT" in
  migrations) migrations ;;
  functions) functions ;;
  all) migrations; functions ;;
  *) echo "usage : $0 [migrations|functions|all]" >&2; exit 2 ;;
esac
