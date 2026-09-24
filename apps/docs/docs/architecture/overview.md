---
sidebar_position: 1
---

# Architecture Overview

Oppenheimer follows a monorepo architecture with clear separation of concerns.

## Backend

The API (`apps/api`) is built with NestJS and consumes 5 reusable backend packages from `packages/backend/`:

- **Authentication**: Better Auth (email/password + Google/GitHub OAuth), cookie sessions
- **Authorization**: CASL (role-based + attribute-based)
- **Database**: PostgreSQL with TypeORM
- **Caching**: Redis via [`@oppenheimer/backend-cache`](./backend-packages#oppenheimerbackend-cache)
- **Queues**: BullMQ via [`@oppenheimer/backend-queue`](./backend-packages#oppenheimerbackend-queue)
- **Email**: Pluggable with React Email templates via [`@oppenheimer/backend-email`](./backend-packages#oppenheimerbackend-email)
- **Storage**: Pluggable (Local / S3) via [`@oppenheimer/backend-storage`](./backend-packages#oppenheimerbackend-storage)
- **Cross-cutting**: Structured errors, correlation IDs, input sanitization via [`@oppenheimer/backend-core`](./backend-packages#oppenheimerbackend-core)
- **Logging**: Pino structured JSON logs
- **Rate limiting**: @nestjs/throttler
- **Health checks**: @nestjs/terminus + custom Redis indicator

See [Backend Packages](./backend-packages) for the shared package details and [API Architecture](./api-architecture) for the full API module breakdown.

## Pluggable service pattern

All backend packages follow the same pattern:

1. **Abstract class** defines the interface (e.g. `EmailService`)
2. **Concrete implementations** provide behavior (e.g. `ConsoleEmailService`, `ResendEmailService`)
3. **`@Global` DynamicModule** with a factory reads config to select the active implementation

This allows swapping providers (e.g. console email in dev, Resend in prod) without changing any consumer code.

## Frontend

The console (`apps/web`) builds on the `packages/frontend` tier, which implements clean architecture:

- **Domain layer**: Entities, repository interfaces, service interfaces
- **Presentation layer**: Zustand stores, view models
- **Data access layer**: Repository implementations, API client adapters

Dependency injection is handled by InversifyJS, allowing platform-specific implementations (storage, auth client, analytics) to be swapped in.

See [Frontend Architecture](./frontend-architecture) for details.
