FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# The lockfile and every manifest the API's graph needs, and nothing else, so
# both installs below are cached until one of them changes.
FROM base AS manifests
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

# Everything the build needs, devDependencies included.
FROM manifests AS deps
RUN pnpm install --frozen-lockfile --filter @oppenheimer/api...

# What the process needs at runtime, and only that. The build needs every
# devDependency of the API's graph and of the workspace root — TypeScript,
# Vitest, SWC, Testcontainers, the Nest CLI, Biome, Turbo, Playwright, even
# Next.js — and shipping that tree made a 1.9 GB image with a test runner and a
# browser driver in production. A fresh install rather than a prune: pnpm's
# prune-in-place purges and relinks, and in a filtered workspace that trips on
# lockfile entries of projects outside the filter.
FROM manifests AS prod-deps
RUN pnpm install --prod --frozen-lockfile --filter @oppenheimer/api...

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
#
# node_modules come from `prod-deps`, the built packages from `builder`. The
# packages' own node_modules are laid over the builder's, so each links to the
# production store; a link the builder left for a devDependency is removed.
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages
COPY --from=prod-deps --chown=nestjs:nodejs /app/packages ./packages
COPY --from=prod-deps --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/
RUN find /app -type l ! -exec test -e {} \; -delete

USER nestjs
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main"]
