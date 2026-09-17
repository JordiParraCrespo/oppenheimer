# @oppenheimer/backend-i18n — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first.

## Where things go

- Lookup and interpolation are `src/translator.ts`; `Intl` wrappers (money,
  dates, relative time) are `src/formatter.ts`; `src/i18n.service.ts` is what
  a NestJS provider injects; `src/i18n.module.ts` takes the bundles.
- This package owns no copy. A new string goes in
  `packages/translations/<locale>/index.json`, in every locale, and the API
  passes the bundles in `app.module.ts`.

## Before pushing

```bash
pnpm --filter @oppenheimer/backend-i18n test
pnpm --filter @oppenheimer/backend-i18n build
```

## Patterns agents get wrong

- Adding a key to one locale. The API's tests compare the catalogs; a key
  missing from a locale is a failure, not a fallback.
- Formatting a date or an amount with `toLocaleString` in a template. The
  formatter takes the locale and the time zone the caller resolved.
- Reading the request's locale here. There is no request in a queue job or a
  digest; the caller resolves the locale and passes it.

See [`.agents/rules/backend-packages.md`](../../../.agents/rules/backend-packages.md).
