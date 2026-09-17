---
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/frontend-mobile": minor
"@oppenheimer/shared": minor
"@oppenheimer/translations": minor
---

Adopt React Hook Form across `apps/web` and `apps/mobile`.

Every auth form on both platforms now runs through `useForm`, validated against
the Zod schemas in `@oppenheimer/shared` via `@hookform/resolvers`. Web forms were
uncontrolled `FormData` reads leaning on native browser validation, and mobile
screens held one `useState` per field and reported the first Zod failure in an
`Alert`. Both now surface per-field errors inline, next to the input that caused
them, and no longer submit until the whole form parses.

`@oppenheimer/frontend-core` gains a `/validation` entrypoint exporting
`createZodErrorMap`, and each platform kit a `useZodResolver` over it.
The shared schemas carry English messages because the API validates against the
same objects, so the map re-derives the message from the Zod issue code and
resolves it against a `validation.*` translation key. Each app passes its own
`t`, which keeps the messages localised without duplicating the schemas.
`TranslateFn` is deliberately narrow — a `t` typed over the full catalog is
assignable to it, so a missing key is a compile error rather than a raw key
rendered to the user.

The auth schemas in `@oppenheimer/shared` no longer hardcode their failure messages.
Zod short-circuits any error map when a check states its own message, so
`z.string().email('Invalid email address')` pinned every consumer to English. The
shapes are unchanged, and nothing outside the two frontends read those strings —
the API authenticates through Better Auth rather than these schemas.

`@oppenheimer/shared` also adds a `./schemas/auth` export. `apps/web` could not import
the schemas from the package root: that pulls in the scope catalog and CASL,
neither of which belongs in the browser bundle. The narrow subpath depends on
nothing but Zod. Because workspace `dist` folders sit outside `node_modules`,
`apps/web/vite.config.ts` now points the CommonJS interop plugin and
`optimizeDeps` at it — without that, Rollup cannot see the named exports.

`@oppenheimer/translations` adds the `validation.*` messages the error map resolves
(`required`, `email`, `minLength`, `maxLength`, `minItems`, `maxItems`) plus
`apiTokens.permissionsRequired`, in both English and Spanish.
