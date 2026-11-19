#!/bin/sh
# Starts the Price Space demo: schema, demo data, two logins, then the server.
#
# Safe to run on every start. Migrations are recorded and skipped once applied,
# and the logins are upserted, so a restart changes nothing but the passwords
# back to what DEMO.md states.
set -eu

cd "$(dirname "$0")/.."

: "${DEMO_ADMIN_PASSWORD:?DEMO_ADMIN_PASSWORD is not set}"
: "${DEMO_REP_PASSWORD:?DEMO_REP_PASSWORD is not set}"

echo "Applying migrations and demo data..."
node db/migrate.mjs --with-demo-data

echo "Creating demo logins..."
PASSWORD="$DEMO_ADMIN_PASSWORD" ROLE=admin ADMIN=true \
  node_modules/.bin/tsx server/create-user.ts admin@pricespace.demo "Demo Admin"
PASSWORD="$DEMO_REP_PASSWORD" ROLE="Sales Rep" \
  node_modules/.bin/tsx server/create-user.ts rep@pricespace.demo "Demo Sales Rep"

echo "Starting Price Space on port ${PORT:-3000}..."
# exec, so the server receives the stop signal from `docker compose down`.
exec node_modules/.bin/tsx server/index.ts
