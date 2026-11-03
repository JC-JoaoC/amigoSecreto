#!/bin/sh
# Aplica migrations pendentes (idempotente) e inicia o servidor Next.js.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL não definida — abortando." >&2
  exit 1
fi

echo "[entrypoint] aplicando migrations…"
cd /migrate
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] iniciando servidor na porta ${PORT:-3000}"
cd /app
exec node server.js
