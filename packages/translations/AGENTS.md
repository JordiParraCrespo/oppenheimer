# @oppenheimer/translations — Agent Instructions

Shared i18n resources used by `apps/web` (react-i18next) and `apps/api` (email
copy in the recipient's locale).

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first.

## Layout

```
en/{area}.json        # English, one file per product area (source of truth)
es/{area}.json        # Spanish, same keys
en/index.json         # assembled merge (`pnpm --filter @oppenheimer/translations assemble`)
en/browser.json       # the same without the namespaces no browser reads, assembled too
locales.ts            # locale list, default, namespace, Messages type — no catalogs
lazy.ts               # one dynamic import per catalog, for the browsers
index.ts              # the eager barrel: every catalog, for the API
```

**Three entrypoints, and which one you want matters.** `index.ts` imports every
catalog, which is right for the API (it renders email in the recipient's
locale). It is wrong for the web app: pulling `locales` or `Messages` from the root used to put the Spanish
catalog in the entry chunk an English reader downloads before anything renders.
So:

- metadata (`locales`, `defaultLocale`, `defaultNS`, `Locale`, `Messages`) →
  `@oppenheimer/translations/locales`
- a catalog, on demand, in a browser → `@oppenheimer/translations/lazy`
- the default locale, bundled, in a browser → `@oppenheimer/translations/en/browser.json`
  (generated; `NOT_IN_BROWSER` in `scripts/assemble.mjs` lists what it leaves
  out — a screen that starts reading one of those takes it off the list)
- every catalog at once → `@oppenheimer/translations`

Adding a locale means a directory, an entry in `locales.ts`, and a line in
`lazy.ts`'s loader map — written out longhand, because a bundler cannot split a
template-string import.

## Conventions

- **New translations go in `packages/translations/{locale}/{area}.json`** — not
  inline in app code. Run `pnpm --filter @oppenheimer/translations assemble` so
  `{locale}/index.json` matches. Call sites keep `t('auth.login')`.
- Keep the key structure identical across every locale; add a key to _all_
  locales when introducing new copy so nothing falls back silently.
- The console and the API's email templates consume the same bundles, so keys
  must stay platform-neutral.
- The `validation.*` keys back form validation: `createZodErrorMap` in
  `@oppenheimer/frontend-core/validation` (`packages/frontend/core/src/validation/`) resolves a Zod issue code to one of them. Adding
  a case there means adding the key here, in every locale — the apps type `t()`
  against this catalog, so a missing entry fails the build rather than shipping
  a raw key. See [`.agents/rules/forms.md`](../../.agents/rules/forms.md).
- Interpolate validation bounds with named params (`{{min}}`, `{{max}}`), not
  `count` — i18next reads `count` as a pluralisation trigger and looks for
  `_one` / `_other` variants.
- A counted key needs every plural form its locale has. English has `_one` and
  `_other`; Spanish also has `_many` (a million or more: "1 millón de
  sesiones"), which i18next asks for and does not fall back from. Give it the
  `_other` wording unless the sentence needs "de".
- A refine in a shared schema names its message with
  `.refine(fn, { params: { i18nKey: 'validation.…' } })`; the key must be one
  of `VALIDATION_MESSAGE_KEYS` in `createZodErrorMap`.

## Commands

```bash
pnpm --filter @oppenheimer/translations lint
```
