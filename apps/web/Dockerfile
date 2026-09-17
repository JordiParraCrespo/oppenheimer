FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/auth/package.json ./packages/auth/
COPY packages/shared/package.json ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/frontend/design-system/web/package.json ./packages/frontend/design-system/web/
COPY packages/frontend/core/package.json ./packages/frontend/core/
COPY packages/frontend/consumer/package.json ./packages/frontend/consumer/
COPY packages/frontend/api-client/package.json ./packages/frontend/api-client/
COPY packages/frontend/web/package.json ./packages/frontend/web/
COPY packages/translations/package.json ./packages/translations/
RUN pnpm install --frozen-lockfile --filter @oppenheimer/web...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY . .
RUN pnpm --filter @oppenheimer/web... build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
# Precompress every text asset once, at level 9, so `gzip_static` can serve a
# ready-made .gz instead of compressing the same bytes on every request. woff2
# is already compressed and is deliberately skipped.
RUN find /usr/share/nginx/html -type f \
      \( -name '*.js' -o -name '*.css' -o -name '*.svg' -o -name '*.json' \
         -o -name '*.html' -o -name '*.txt' \) \
      -exec sh -c 'gzip -9c "$1" > "$1.gz"' _ {} \;
ENV API_UPSTREAM=api:3001
# Origins the Content-Security-Policy in nginx.conf admits beyond 'self'.
# Defaults to the PostHog EU endpoints, matching VITE_POSTHOG_HOST's default;
# widen it when the analytics project is in another region or VITE_API_URL
# points the app at a different origin.
ENV CSP_EXTRA_ORIGINS="https://eu.i.posthog.com https://eu-assets.i.posthog.com"
ENV NGINX_ENVSUBST_FILTER='(API_UPSTREAM|CSP_EXTRA_ORIGINS)'
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
