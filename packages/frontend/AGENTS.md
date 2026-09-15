# @oppenheimer/frontend — Agent Instructions

Platform-agnostic frontend core shared by `apps/web` and `apps/mobile`. This is
where frontend **business logic** lives — not in app components/screens.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first.

## Architecture

Clean architecture with **InversifyJS** dependency injection and **Zustand**
vanilla stores. Each app supplies platform-specific implementations (storage,
HTTP, navigation) by binding them into the DI container.

```
src/
├── modules/          # feature modules
│   ├── auth/
│   ├── users/
│   └── core/         # cross-module primitives
├── di/               # InversifyJS container, tokens, bindings
├── react/            # React bindings/hooks (useInjection, providers)
├── validation/       # Zod error map bridging schemas to translated messages
└── index.ts
```

Per module, follow the layering: **domain → presentation → data-access**.

## Conventions

- **Zustand vanilla stores** are framework-agnostic so web and mobile share
  them; the `react/` layer exposes them to components.
- **TanStack Query** manages server state.
- Data-access wraps `@oppenheimer/api-client`; never call HTTP directly from domain.
- Platform-specific behavior is injected via DI — depend on abstractions
  (ports/tokens) defined in `di/`, not on concrete app code.
- Shared types/schemas come from `@oppenheimer/shared`.
- `validation/` (exported as `@oppenheimer/frontend/validation`) holds
  `createZodErrorMap`, which turns a Zod issue code into a `validation.*`
  translation key so both apps' forms report failures in the user's language.
  It takes a `translate` callback rather than depending on i18next, keeping the
  package i18n-agnostic; each app passes its own `t`.

  Adding a case means adding the key to `ValidationMessageKey` **and** to every
  locale in `@oppenheimer/translations`. `TranslateFn` is deliberately narrow: a `t`
  typed over the full catalog is assignable to it, so a key missing from the
  locales is a compile error in the apps. Full convention in
  [`.agents/rules/forms.md`](../../.agents/rules/forms.md).

- `modules/core/error-message.ts` is the same idea for **API failures**:
  `createErrorMessageResolver` turns anything thrown by a repository into a
  message translated from the problem document's `code`. Screens must not render
  `error.message` — the server's `detail`/`title` are English, written for
  operators and the CLI, so putting them on screen leaks English into every
  locale. Each app wraps it in a hook (`useErrorMessage` in `apps/web/src/lib/`).

  A new API error code needs an entry under `errors.byCode.<CODE>` in every
  locale in `@oppenheimer/translations`; an unknown code falls back to a generic
  translated sentence rather than the server's wording.

## Commands

```bash
pnpm --filter @oppenheimer/frontend build
pnpm --filter @oppenheimer/frontend dev
pnpm --filter @oppenheimer/frontend test
```
