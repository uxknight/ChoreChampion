#!/usr/bin/env bash
# Reset the local DB to the seed baseline, then run the SQL acceptance suite.
set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB="supabase_db_Chore_Champion"
cd "$DIR"
supabase db reset >/tmp/cc-reset.log 2>&1
docker cp supabase/tests/acceptance.sql "$DB":/tmp/acceptance.sql >/dev/null
docker exec -i "$DB" psql -U postgres -d postgres -f /tmp/acceptance.sql 2>&1 \
  | grep -E "PASS:|FAIL:|ERROR|PASSED" \
  | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR):  //'
