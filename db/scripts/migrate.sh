#!/bin/sh
# รัน migration ที่ยังไม่เคยรัน ตามลำดับชื่อไฟล์ (timestamp) ไฟล์ละหนึ่ง transaction
set -eu

psql -q -v ON_ERROR_STOP=1 -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   text        PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)"

for f in /db/migrations/*.sql; do
  name=$(basename "$f")
  if [ -n "$(psql -tA -c "SELECT 1 FROM schema_migrations WHERE filename = '$name'")" ]; then
    echo "skip  $name"
    continue
  fi
  echo "apply $name"
  psql -q -v ON_ERROR_STOP=1 -1 -f "$f" -c "INSERT INTO schema_migrations (filename) VALUES ('$name')"
done
