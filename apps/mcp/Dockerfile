FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/mcp/package.json ./apps/mcp/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY packages/env/package.json ./packages/env/
RUN pnpm install --frozen-lockfile --filter @oppenheimer/mcp...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY . .
RUN pnpm --filter @oppenheimer/mcp... build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 mcp

COPY --from=builder --chown=mcp:nodejs /app/apps/mcp/dist ./dist
COPY --from=builder --chown=mcp:nodejs /app/apps/mcp/node_modules ./node_modules
COPY --from=builder --chown=mcp:nodejs /app/apps/mcp/package.json ./
COPY --from=builder --chown=mcp:nodejs /app/node_modules ./node_modules

USER mcp
EXPOSE 3005

# The remote (Streamable HTTP) entrypoint. Each request carries its own
# credential, so the container holds no secrets of its own.
CMD ["node", "dist/bin/http.js"]
