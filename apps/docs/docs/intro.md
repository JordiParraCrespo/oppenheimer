---
slug: /
sidebar_position: 1
---

# Oppenheimer

Full-stack monorepo boilerplate for bootstrapping applications fast.

## What's included

- **apps/api** — NestJS REST API with auth, queues, caching, and more
- **apps/web** — Consumer Vite + TanStack Router SPA
- **apps/mobile** — Consumer Expo app with NativeWind
- **apps/admin-web** — Browser control plane for users, roles, and permissions
- **apps/admin-mobile** — Native control plane for users and roles
- **apps/docs** — This documentation site (Docusaurus)
- **packages/shared** — Zod schemas, types, CASL permissions
- **packages/frontend** — Clean architecture with InversifyJS DI
- **packages/design-system** — Shared tokens, web and mobile components
- **packages/api-client** — Auto-generated typed API client
- **packages/translations** — Shared i18n files
- **packages/config** — Shared TypeScript and tooling configs

### Backend packages

Reusable NestJS modules under `packages/backend/`, each following a pluggable service pattern:

- **@oppenheimer/backend-core** — Errors, filters, interceptors, pipes, mapper interface
- **@oppenheimer/backend-email** — Pluggable email (Console / Nodemailer / Resend) with React Email templates
- **@oppenheimer/backend-cache** — Redis cache abstraction
- **@oppenheimer/backend-storage** — File storage (Local / S3)
- **@oppenheimer/backend-queue** — BullMQ async jobs + Bull Board admin UI
