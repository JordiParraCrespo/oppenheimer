---
sidebar_position: 2
---

# Project Structure

```
oppenheimer/
├── apps/
│   ├── api/              # NestJS REST API
│   ├── admin-mobile/     # Expo control plane
│   ├── admin-web/        # Vite control plane
│   ├── docs/             # Docusaurus documentation
│   ├── mobile/           # Consumer Expo app
│   └── web/              # Consumer Vite SPA
├── packages/
│   ├── api-client/       # Auto-generated typed API client
│   ├── backend/
│   │   ├── cache/        # Redis cache abstraction (@oppenheimer/backend-cache)
│   │   ├── core/         # Errors, filters, pipes, interceptors (@oppenheimer/backend-core)
│   │   ├── email/        # Pluggable email + React Email templates (@oppenheimer/backend-email)
│   │   ├── queue/        # BullMQ + Bull Board (@oppenheimer/backend-queue)
│   │   └── storage/      # File storage Local/S3 (@oppenheimer/backend-storage)
│   ├── config/           # Shared TS and tooling configs
│   ├── design-system/    # Tokens + web + mobile components
│   ├── frontend/         # Clean architecture, DI, stores
│   ├── shared/           # Zod schemas, types, permissions
│   └── translations/     # Shared i18n JSON files
├── docker/               # Docker Compose files
├── helm/                 # Kubernetes Helm charts
├── .github/              # GitHub Actions workflows
├── turbo.json            # Turborepo config
└── pnpm-workspace.yaml   # pnpm workspace config
```

## Dependency flow

```
packages/config           → all apps and packages (tsconfig extends)
packages/shared           → api, frontend, api-client
packages/backend/core     → api, other backend packages
packages/backend/email    → api
packages/backend/cache    → api
packages/backend/storage  → api
packages/backend/queue    → api
packages/translations     → consumer and control-plane apps
packages/design-system    → consumer and control-plane apps
packages/api-client       → frontend
packages/frontend         → consumer and control-plane apps
```
