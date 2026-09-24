---
sidebar_position: 2
---

# Project Structure

```
oppenheimer/
├── apps/
│   ├── api/              # NestJS REST API (the control plane)
│   ├── docs/             # Docusaurus documentation
│   ├── runner/           # Go host agent
│   ├── web/              # The console: Vite + TanStack Router SPA
│   └── web-showcase/     # Next.js showcase of the web design system
├── packages/
│   ├── backend/
│   │   ├── cache/        # Redis cache abstraction (@oppenheimer/backend-cache)
│   │   ├── core/         # Errors, filters, pipes, interceptors (@oppenheimer/backend-core)
│   │   ├── email/        # Pluggable email + React Email templates (@oppenheimer/backend-email)
│   │   ├── queue/        # BullMQ + Bull Board (@oppenheimer/backend-queue)
│   │   └── storage/      # File storage Local/S3 (@oppenheimer/backend-storage)
│   ├── auth/             # Shared Better Auth config (@oppenheimer/auth)
│   ├── env/              # Root .env loader (@oppenheimer/env)
│   ├── frontend/
│   │   ├── core/         # Kernel every app loads: session, users, settings, DI (@oppenheimer/frontend-core)
│   │   ├── consumer/     # The console's domain: sessions, hosts, account (@oppenheimer/frontend-consumer)
│   │   ├── api-client/   # Auto-generated typed client from Swagger (@oppenheimer/api-client)
│   │   ├── web/          # Web platform kit: shell, auth chrome, table, i18n (@oppenheimer/frontend-web)
│   │   └── design-system/web/ # Tokens + components (@oppenheimer/design-system-web)
│   ├── go/               # Shared Go modules (@oppenheimer/go-*)
│   ├── shared/           # Zod schemas, types, permissions
│   ├── translations/     # Shared i18n JSON files
│   └── tsconfig/         # Shared TS configs + build helpers (@oppenheimer/tsconfig)
├── docker/               # Docker Compose files
├── .github/              # GitHub Actions workflows
├── turbo.json            # Turborepo config
└── pnpm-workspace.yaml   # pnpm workspace config
```

## Dependency flow

```
packages/tsconfig         → all apps and packages (tsconfig extends)
packages/shared           → api, frontend, api-client
packages/backend/core     → api, other backend packages
packages/backend/email    → api
packages/backend/cache    → api
packages/backend/storage  → api
packages/backend/queue    → api
packages/translations     → web, api (email copy)
packages/frontend/design-system/web    → web, web-showcase, frontend/web
packages/frontend/api-client  → frontend/core, frontend/consumer
packages/frontend/core        → every frontend package and app
packages/frontend/consumer    → web
packages/frontend/web         → web
packages/go/core              → every other packages/go module and runner
```
