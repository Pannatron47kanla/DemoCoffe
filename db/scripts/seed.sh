#!/bin/sh
# ใส่ข้อมูลทดสอบ ห้ามรันกับ production
set -eu

if [ "${APP_ENV:-}" != "development" ] && [ "${APP_ENV:-}" != "test" ]; then
  echo "seed: APP_ENV must be development or test (got '${APP_ENV:-}')" >&2
  exit 1
fi

psql -q -v ON_ERROR_STOP=1 -1 -f /db/seed.sql
echo "seed: done"
