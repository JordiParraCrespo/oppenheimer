# @oppenheimer/translations

Shared i18n resources for the console and the API. Locale JSON lives here so
the web app and the server's email copy come from one source.

## What's inside

- `en/index.json`, `es/index.json` — translation catalogs (one namespace per locale).
- `locales.ts` — locale metadata with **no** catalog imports: `locales`,
  `defaultLocale`, `defaultNS`, `type Locale`, `type Messages`.
- `lazy.ts` — `loadLocaleMessages(locale)`, one dynamic import per catalog, so a
  bundler emits a chunk per locale.
- `index.ts` — the eager barrel: `resources` and `messages` with every catalog
  loaded, plus a re-export of everything in `locales.ts`.

## Usage

Pick the entrypoint by what the platform can afford to load.

```ts
// The server — every catalog, no network.
// apps/api renders email in the recipient's locale.
import { resources, defaultNS } from "@oppenheimer/translations";

// Browsers — metadata only, no catalogs. Importing `locales` from the root
// would put every catalog in the entry chunk.
import { defaultLocale, defaultNS, locales } from "@oppenheimer/translations/locales";

// Browsers — one catalog, when it turns out to be the reader's.
import { loadLocaleMessages } from "@oppenheimer/translations/lazy";

// Raw JSON is also reachable per-locale:
import en from "@oppenheimer/translations/en";
```

`apps/web` wires these into its own `react-i18next` instance, bundling only
`defaultLocale` and serving the rest through a small backend module over
`loadLocaleMessages` (see `apps/web/src/lib/i18n.ts`).

## Adding a translation

Add the key to **every** locale file under the matching path
(`packages/translations/{locale}/index.json`). Keys must exist in all locales so
`t()` never falls back unexpectedly.

## Adding a locale

Three edits: the catalog directory, an entry in `locales.ts`'s `locales` tuple,
and a line in `lazy.ts`'s loader map. The map is written out longhand because a
bundler cannot split a template-string `import()` — a computed specifier either
bundles every match or resolves nothing.

## Consumed by

`apps/web`, `packages/frontend/web`, `apps/api` (through `@oppenheimer/backend-i18n`).
