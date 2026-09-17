FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/mcp/package.json ./apps/mcp/
COPY packages/shared/package.json ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/
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

# pnpm links workspace packages with **relative** symlinks whose depth encodes
# the layout (`apps/mcp/node_modules/@oppenheimer/env` → `../../../../packages/env`),
# and `@oppenheimer/env/load` is required at runtime. Flattening the app's
# node_modules onto /app moves those links two levels up and they dangle, so
# keep the depth they were written for and run from the app directory, as the
# API image does.
COPY --from=builder --chown=mcp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mcp:nodejs /app/packages ./packages
COPY --from=builder --chown=mcp:nodejs /app/apps/mcp/node_modules ./apps/mcp/node_modules
COPY --from=builder --chown=mcp:nodejs /app/apps/mcp/dist ./apps/mcp/dist
COPY --from=builder --chown=mcp:nodejs /app/apps/mcp/package.json ./apps/mcp/

USER mcp
WORKDIR /app/apps/mcp
EXPOSE 3005

# The remote (Streamable HTTP) entrypoint. Each request carries its own
# credential, so the container holds no secrets of its own.
CMD ["node", "dist/bin/http.js"]
