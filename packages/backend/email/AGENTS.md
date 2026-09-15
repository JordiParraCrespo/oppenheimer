# @oppenheimer/backend-email — Agent Instructions

Pluggable email delivery plus React Email templates.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) and
> [`.agents/rules/backend-packages.md`](../../../.agents/rules/backend-packages.md)
> (see the email-template setup notes there).

## Layout

```
src/
├── email.module.ts            # NestJS module + factory
├── email.service.ts           # abstract EmailService (the port)
├── console-email.service.ts   # dev: logs to console
├── nodemailer-email.service.ts# SMTP via nodemailer
├── resend-email.service.ts    # Resend provider
├── render.ts                  # React Email -> HTML rendering
├── templates/                 # React Email templates
└── index.ts
```

## Conventions

- **Pluggable service pattern**: abstract `EmailService` → concrete providers
  (console / nodemailer / resend) → selected by the factory in `EmailModule`.
  Add a provider as another concrete class; do not branch inside callers.
- Templates are **React Email** components rendered via `render.ts`.
- Ships **CommonJS**.

## Commands

```bash
pnpm --filter @oppenheimer/backend-email build
pnpm --filter @oppenheimer/backend-email dev
```
