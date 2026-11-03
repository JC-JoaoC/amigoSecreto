# syntax=docker/dockerfile:1.7
# Imagem de produção do Laço (Next.js standalone + Prisma).
# Ao iniciar, aplica as migrations pendentes e sobe o servidor na porta 3000.

FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# 1) Dependências (o postinstall roda `prisma generate`, por isso o schema vem antes)
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# 2) Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

# 3) Ferramenta de migration isolada (só prisma CLI + dotenv)
FROM base AS migrator
WORKDIR /migrate
RUN npm init -y >/dev/null \
  && npm install --no-audit --no-fund --omit=dev prisma@7.10.1 dotenv@18
COPY prisma ./prisma
COPY prisma.config.ts ./

# 4) Execução
FROM base AS runner
ENV NODE_ENV=production \
  PORT=3000 \
  HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=migrator --chown=node:node /migrate /migrate
COPY --chown=node:node docker/entrypoint.sh /entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["sh", "/entrypoint.sh"]
