---
slug: /
sidebar_position: 1
---

# Oppenheimer

Full-stack monorepo boilerplate for bootstrapping applications fast.

## What's included

- **apps/api** — NestJS REST API with auth, queues, caching, and more
- **apps/web** — The console: Vite + TanStack Router SPA
- **apps/web-showcase** — Next.js app showcasing the web design system
- **apps/runner** — The Go host agent: pairing, worktrees, tmux sessions, signed self-update
- **apps/docs** — This documentation site (Docusaurus)
- **packages/shared** — Zod schemas, types, CASL permissions
- **packages/frontend/core** — The kernel every app loads: session, users, user settings, capabilities, analytics, InversifyJS DI
- **packages/frontend/consumer** — The console's domain: sessions, hosts, organizations, profile, api-tokens
- **packages/frontend/web** — The web platform kit: shell, auth chrome, table, i18n, theme below the routes
- **packages/frontend/design-system** — Tokens and components (shadcn/ui + Base UI + Tailwind v4)
- **packages/frontend/api-client** — Auto-generated typed API client
- **packages/translations** — Shared i18n files
- **packages/tsconfig** — Shared TypeScript and tooling configs

### Backend packages

Reusable NestJS modules under `packages/backend/`, each following a pluggable service pattern:

- **@oppenheimer/backend-core** — Errors, filters, interceptors, pipes, mapper interface
- **@oppenheimer/backend-email** — Pluggable email (Console / Nodemailer / Resend) with React Email templates
- **@oppenheimer/backend-cache** — Redis cache abstraction
- **@oppenheimer/backend-llm** — One interface over LLM providers (OpenRouter, Together, Anthropic, any OpenAI-compatible server)
- **@oppenheimer/backend-storage** — File storage (Local / S3)
- **@oppenheimer/backend-queue** — BullMQ async jobs + Bull Board admin UI
