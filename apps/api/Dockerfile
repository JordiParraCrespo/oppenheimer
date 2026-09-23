FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/auth/package.json ./packages/auth/
COPY packages/shared/package.json ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/env/package.json ./packages/env/
COPY packages/translations/package.json ./packages/translations/
COPY packages/backend/authz/package.json ./packages/backend/authz/
COPY packages/backend/core/package.json ./packages/backend/core/
COPY packages/backend/ddd/package.json ./packages/backend/ddd/
COPY packages/backend/cache/package.json ./packages/backend/cache/
COPY packages/backend/email/package.json ./packages/backend/email/
COPY packages/backend/i18n/package.json ./packages/backend/i18n/
COPY packages/backend/llm/package.json ./packages/backend/llm/
COPY packages/backend/queue/package.json ./packages/backend/queue/
COPY packages/backend/storage/package.json ./packages/backend/storage/
RUN pnpm install --frozen-lockfile --filter @oppenheimer/api...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY . .
RUN pnpm --filter @oppenheimer/api... build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# pnpm links dependencies with **relative** symlinks whose depth encodes the
# workspace layout: `apps/api/node_modules/@oppenheimer/env` points at
# `../../../../packages/env`, and every third-party package points into
# `../../node_modules/.pnpm/…`. Flattening `apps/api/node_modules` onto
# `/app/node_modules` moves them two levels up, so every one of those links
# resolves outside the filesystem root and dangles. It also matters for
# `@oppenheimer/translations`, whose JSON bundles the API requires at runtime.
#
# So keep the depth the links were written for, and run from the app directory.
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/

USER nestjs
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main"]
