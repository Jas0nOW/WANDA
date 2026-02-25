# =============================================================================
# Wanda — Dockerfile (Multi-stage)
# =============================================================================
# Non-root user. Read-only root FS. /data volume for persistence.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate
WORKDIR /app

# --- Dependencies ---
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/secrets/package.json packages/secrets/
COPY packages/core/package.json packages/core/
COPY packages/channels/package.json packages/channels/
COPY packages/providers/package.json packages/providers/
COPY packages/tools/package.json packages/tools/
COPY packages/memory/package.json packages/memory/
COPY packages/sandbox/package.json packages/sandbox/
COPY apps/wanda-bot/package.json apps/wanda-bot/
RUN pnpm install --frozen-lockfile

# --- App ---
FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY . .

# Non-root user
RUN addgroup -g 1000 wanda && \
    adduser -u 1000 -G wanda -s /bin/sh -D wanda && \
    mkdir -p /data && chown wanda:wanda /data

USER wanda
VOLUME ["/data"]
ENV NODE_ENV=production
ENV DATA_DIR=/data

CMD ["node", "--import", "tsx", "apps/wanda-bot/src/index.ts"]
