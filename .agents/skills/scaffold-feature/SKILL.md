---
name: scaffold-feature
description: Build a feature in the Oppenheimer web console (apps/web) the way a senior frontend engineer on this codebase would. It starts from the domain module in packages/frontend (sessions, hosts, projects, installations, organizations, profile, api-tokens, or the kernel's), writes down every query and mutation and which component draws each result, then places each piece in its kind directory, and it ends with the checks passing. Use it whenever the user asks for a new screen, page, section, dialog, form, list, settings page or UI flow in the console. Also use it when they describe something that needs UI ("show a host's activity", "let people revoke API tokens"), when a new API endpoint needs a screen, or when they ask to review, fix or refactor a frontend feature, even if they never say "feature" or "scaffold".
---

# Build a console feature

This skill turns a request into a feature that passes review here and still
holds up when the next person changes it. The standard is three rule files,
and you should read them first:

- `.agents/rules/frontend-architecture.md`: placement, what may import what,
  the render rules.
- `.agents/rules/forms.md`: React Hook Form over a shared Zod schema.
- `.agents/rules/frontend-ui.md`: design system first, the colour vocabulary,
  dates, translations, e2e.

This skill is the process that gets you there. The rules are applied because
of the reads and writes the feature makes, not recited from memory.

There is one frontend app, `apps/web` (the console). `apps/web-showcase` is
the design system's gallery, not a product surface: nothing here goes there.

The reference features:

- `apps/web/src/features/hosts`: Settings → Hosts. A screen that composes, a
  list section that fetches (`sections/host-list.tsx`), a row that owns what
  its menu opens (`sections/host-row.tsx`), a remove dialog that owns its
  mutation, and a rename form that never fetches.
- `packages/frontend/consumer/src/modules/hosts` with
  `react/hosts.queries.ts`: the domain module, its key ladder,
  `shareEntities`, `select` and the `useHostsSnapshot()` read.
- `apps/web/src/features/sessions/__tests__/sessions-sidebar-render.spec.tsx`:
  a render budget, one assertion per clock.

Read the one closest to your task before writing.

## 1. Decide the size of the change

Most requests are one or two files in a feature that already exists, not a
new feature. Before creating anything, answer these:

- **Which module does the UI render?** A feature is named after a module of
  `packages/frontend/core` (`auth`, `users`, `user-settings`, `capabilities`,
  `analytics`, `feature-flags`) or of the product package
  `packages/frontend/consumer` (`sessions`, `hosts`, `projects`,
  `installations`, `automations`, `organizations`, `profile`, `api-tokens`),
  or is on the app's allowlist (`public`). Never name it after a page (`settings`, `console`, `home`).
  `ls packages/frontend/*/src/modules` shows what exists.
  - `sessions` are the agent sessions (a worktree and a tmux terminal on a
    host). The browsers signed in to an account are `profile`
    (`useProfileSessions`), not `sessions`.
  - `installations` are the workspace's GitHub App installations and their
    repositories; `projects` group repositories and default a host and agent.
- **Does the feature exist already?** Then add a file to the right kind
  directory, and do not run the generator.
- **Is it a screen this console has?** Settings is its own chrome beside the
  console (`routes/_authenticated/settings.tsx`); each settings page is a
  child route and a `SettingsSidebar` item, not a `?section=` pane. Pages
  that fill something in steps (New project, Add host) are `EditorPage`s under
  the `_editor` layout. The console's sidebar *is* the session list. Workspaces
  are personal: there is no roster, invitation or team UI to build, whatever
  the API serves (`product/versions/mvp/08-auth.md`).
- **Does the API serve it?** Look for the endpoint in `apps/api/openapi.json`
  and the generated client in `packages/frontend/api-client`. If it isn't
  there, the backend comes first (`/scaffold-module`, then
  `pnpm generate:api-client`), or the feature waits. Never fake data: see
  "Never ship a placeholder number" in `frontend-ui.md`. The `automations`
  pages are the example of a screen drawn ahead of its API; they keep their
  primary action off rather than pretend.
- **What does the API allow and refuse?** Read the controller behind each
  endpoint, not only its path:
  - its `@CheckPolicies`, which is the permission each action needs;
  - the errors it throws (and their rows in the error catalog);
  - the business rules enforced below it, in the domain entity or the
    command handler (a removed host leaves the list; an archived project's
    directory name is never reissued; a token may only be revoked by the
    user who owns it).

  The UI mirrors all of these (step 3). An action the server would refuse is
  not offered, or it says why.
- **Build what was asked.** A filter, a key variant or a column that no screen
  uses is dead code on the day it lands. Note it as a follow-up instead.

When something here changes the design and cannot be inferred, ask. Otherwise
state your assumption in the summary and move on. When a design export
exists for the screen (`product/versions/mvp/design/`), it is the layout;
port its values onto the design system (`/design-export-port`), never around
it.

## 2. The domain leads: the module in the product package

When the module does not exist, or lacks the call you need, add it before any
UI. Put it in `packages/frontend/consumer`, or in core when the kernel owns
it. The steps are the "Add a module to a product package" cookbook in
`packages/frontend/ARCHITECTURE.md`, with the code in
`references/templates.md` §1–3. In short:

1. **Entity:** a class with readonly fields and derived getters. It is what
   the UI needs, not the DTO; a fact the API did not report is `null`, never a
   placeholder (`HostDetails`).
2. **Errors:** `THINGS_CLIENT_00n` fallbacks, used only when the API sent no
   problem document.
3. **Repository:** calls `heyApiSdk` from `@oppenheimer/api-client` through
   `unwrap` / `unwrapBody` (the SDK function is the API slice's name:
   `FindThingsHttpController` is `findThings`), maps DTOs to
   entities, and puts `@MapApiError` on every method. An absent body is a
   failed read, never `[]`.
4. **Module, tokens, `ConsumerApp` getter** — and a **service only when a
   method does more than call the repository**; otherwise the getter returns
   the repository (`packages/frontend/ARCHITECTURE.md`, step 4).
5. **Query hooks** in `src/react/<module>.queries.ts`:
   - A **key factory with one function per level**
     (`all → lists() → list(filters) → details() → detail(id)`, nested
     resources under their detail as in `installations.queries.ts`).
   - `skipToken` for a missing input, never `enabled` beside a `queryFn`.
   - `useQuery` / `useQueries` come from `@oppenheimer/frontend-core/react`,
     which share entities across refetches. A list hook takes a narrowing
     `select`; a read that only happens in an event handler gets a
     `use…Snapshot()` instead of a subscription.
   - Mutation hooks take `options?: UseMutationOptions<…>` and write the cache
     through `withCacheOnSuccess(options, update)`. Invalidate by the
     narrowest prefix that covers what changed, and write the row the server
     returned with `setQueryData` when you have it. Never a bare
     `invalidateQueries()`.
   - The Biome plugins in `biome-plugins/*.grit` enforce the key-factory,
     `skipToken` and `withCacheOnSuccess` rules; the guide is
     `apps/docs/docs/architecture/query-keys.md`. A key for a generated
     hey-api query goes through `withFeaturePrefix`.
6. If the data must never reach storage (secrets, a pairing token, personal
   data), add `thingsKeys.all[0]` to `CONSUMER_NON_PERSISTED_FEATURES` in
   `src/react/persistence.ts`.
7. Unit-test the entity getters and the key factory (`__tests__/`,
   `react/__tests__/query-keys.spec.ts`).

A flow that chains several calls (claim the workspace, then connect GitHub) is
a hook in the product package, not a `useMutation` written in a screen.
Screens call hooks; they don't orchestrate the API. A live stream (the
session's terminal, `sessions.stream.ts`) is the product package's too.

## 3. Write the render plan

This step is where most features go wrong, and the one most agents skip. List
every read and write the feature makes, and for each one the **lowest
component that draws the result**. That component is the one that calls the
hook.

| # | Hook | Drawn by | Updates on | Allowed when | Notes |
| --- | --- | --- | --- | --- | --- |
| R1 | `useThings()` | `sections/thing-list.tsx` | refetch, a create, a remove | `read Thing` | the create card must not re-render on it |
| R2 | `useThingCatalog()` | `sections/create-thing-card.tsx` | once | — | the list does not need it |
| W1 | `useCreateThing()` | `sections/create-thing-card.tsx` | submit | `create Thing` | the form below takes `onSubmit`, `pending` and `error` |
| W2 | `useRemoveThing()` | `dialogs/remove-thing.tsx` | confirm | `delete Thing`, row still active | the row owns *whether* it is open, since its menu unmounts |
| C1 | `useNow(60_000)` | `components/thing-seen.tsx` | a minute | — | a clock is a leaf of its own |

"Allowed when" is the endpoint's `@CheckPolicies` rule plus any business rule
from step 1.

- **Actions:** each action is offered only where the server would allow it,
  and never where a business rule makes it a certain refusal. A workspace's
  owner holds every rule today, so the console's rows are ungated; a screen
  whose endpoint does need a rule builds the caller's ability from
  `useMyPermissions()` (kernel) with `defineAbilitiesFromPermissions`
  (`@oppenheimer/shared/permissions`) — the kit's nav does the same — and
  hides the action rather than letting it end in a 403.
- **Nav rows:** a gated row in `apps/web/src/lib/nav.ts` or a
  `SettingsSidebar` item takes `policies` from
  `ENDPOINT_POLICIES['<METHOD> <route>']` (`@oppenheimer/shared/permissions`),
  never a literal rule list.
- **States:** every read renders four states:
  - loading: `Skeleton`, or nothing until the first answer when the frame
    draws nothing there (`host-list.tsx`);
  - empty: `EmptyState`, or the design's own empty card (`HostsEmpty`);
  - **failed:** an `Alert variant="destructive"` with the `useErrorMessage()`
    sentence and a retry where one helps, rendered *instead of* the list.
    Never the empty state: "no hosts yet" after a failed request tells the
    reader something false;
  - loaded.

Then check the plan against the render rules:

- **Only one reader?** That reader calls the hook, and the screen above it
  doesn't. A screen that subscribes only to hand the result to one child
  fails `pnpm check:structure`.
- **Two siblings share one result?** Fetching once above them is fine. Say
  so in a comment (`SessionScreen` branches on the one session it reads).
- **Forwarded props:** a `sections/` or `dialogs/` file that hands a data
  prop straight on without reading it is the mistake the rule names; the
  structure check does not catch it yet, so the review in step 6 must.
- **Clocks:** a keystroke, a poll, a tick and a refetch each update something
  different. A component that holds two of them is two components. Time is
  `useNow(interval)` in the lowest component that draws it, never
  `Date.now()` in render.
- **Live input values** never reach a component that maps over rows. The
  field keeps the half-typed value and hands up the settled one
  (`useSearchDraft` in the kit).
- **State lives in the lowest component that reads it.** The exception: a
  dialog opened from a row's menu keeps its open state in the row or the
  list (`HostRow` holds `removing`), because the menu's content unmounts.
- **Subscribe at the leaf:** `useWatch`, `useController` and `useFormState`
  go in the component that shows the value, never at form or page level; a
  row subscribes to one entity by `select`. A form spread over several
  sections is a store behind a context whose value never changes
  (`use-new-session-form.ts`).

## 4. Place each piece

| Piece | Directory | May fetch or use the router |
| --- | --- | --- |
| Page body a route mounts | `screens/` | yes |
| A pane, a list, a card group, a row that owns a mutation | `sections/` | yes |
| A dialog (one per file); it owns its mutation | `dialogs/` | yes |
| A form: props in, `onSubmit` out | `forms/` | **no** |
| Entity UI: a cell, a pill, a hero, an empty card, a menu | `components/` | **no** |
| `use-*.ts`, the only place an effect may live | `hooks/` | yes |
| Types, mappers, constants; no JSX | `lib/` | — |

- **The route file composes:** its `Route`, `validateSearch`, `beforeLoad`,
  `staticData` and a component that renders one screen. Under 120 lines, with
  no query in it that a screen or section could own. Anything that creates,
  moves, renames or guards a route file, or touches `routeTree.gen.ts`, is
  the `/tanstack-routing` skill: a route file's name is its URL.
- **Guards:** `_authenticated` already guards the console and sends an
  account with no workspace to `/onboarding`; a new screen under it inherits
  both. Other guards follow `/tanstack-routing`.
- **Sharing:** features never import each other. What a second feature needs
  moves to the platform kit (`packages/frontend/web`, under a concern) when
  the second consumer appears. Platform-free logic (formatting, slugs,
  permissions) goes to core or the product package, never the kit. Generic
  React hooks (`useNow`, `useDebouncedValue`, `useControlled`) are the
  design system's.
- **Layout:** no sub-directories inside a kind, no `index.ts` in a feature,
  one component per file, kebab-case names without a kind suffix. Import a
  sibling as `@/features/<module>/<kind>/<file>`, as the generator does: the
  structure check reads those imports to find a query handed down, and a
  relative `../sections/…` import walks around it.

For the shapes that recur (a list with a row menu, a create card, an inline
or dialog edit, a settings page, a detail screen, a gated screen, a stepped
editor page), read the matching entry in `references/patterns.md`.

## 5. Write the code

Run the generator only for a **new** feature:

```bash
node scripts/scaffold-feature.mjs --app web --module <module> [--screen <name>]
```

It creates the kind directories and a screen that composes one section, so
the query starts one level down. Delete each `.gitkeep` once its kind has a
file, and every kind directory still empty when you finish. Then write the
pieces from your plan, following `references/templates.md`:

- **Design system and kit first.** Read
  `packages/frontend/design-system/web/src/index.ts` in full (its exports are
  multi-line) and `packages/frontend/web/src/index.ts` before writing markup.
  - Kit: `ConfirmDialog`, `QueryState`, `ErrorAlert`, `RouteError` /
    `RouteNotFound`, `useZodResolver`, `SidebarSearchField`, `useLocale` and
    the date formatters, `SettingsSidebar`; `useErrorMessage` comes from the
    kernel's React entry.
  - Design system: `SettingsTitle` / `SettingsGroup` / `SettingsRow` for a
    settings page, `HostCard`, `EmptyState`, `Skeleton`, `Alert`, `Callout`,
    `Badge` (lifecycle `active` / `paused` / `ended` / `draft`, `neutral` for
    metadata), `toast`, `Field*`, `DialogBody`, `EditorPage` and the
    `PageHeader` parts, `ChipSelect`, `DropdownMenu*`. The table in
    `frontend-ui.md` says which one answers which need.
  - There is no data table in the kit yet. A list that pages or filters keeps
    search, filters and page in the URL, as its routes' search schema, and
    sends them to the API (`frontend-ui.md`, "A list's query lives in the
    URL"; the runs list is the example); build it in the feature and promote
    it on the second.
- **Colour:** the semantic tokens: `text-fg`, `text-fg-muted`,
  `text-fg-subtle`, `text-link`, `bg-canvas`, `bg-surface-*`, `bg-control-*`,
  `border-border`, `border-border-subtle`, `--accent-*`, `--status-*`. The
  older `text-ink-*` aliases are for screens not yet ported, not new code. No
  shadcn aliases (`text-muted-foreground`, `bg-background`), no stock
  Tailwind colours, no `dark:` overrides, and no class the theme doesn't
  declare: check `globals.css`.
- **Forms:** `useForm` with `useZodResolver(schema)` from
  `@oppenheimer/frontend-web`, the schema from
  `@oppenheimer/shared/schemas/<area>` (the schema's own subpath rather than
  the package root; a new `<area>.schema.ts` is a subpath with no config),
  `noValidate`, `Field` with `FieldLabel`,
  `FieldDescription` and `FieldError`, `data-invalid` and `aria-invalid`
  both set. A picker is a `Controller`. An edit form takes `values` (or a
  `key` on the record) so it resets on new data, with no effect. The form
  never applies its own side effects (theme, language, navigation); whatever
  owns the mutation does that on success.
- **Feedback:**
  - Success is a `toast.success()` with its copy under `toasts.*`, or the row
    visibly changing; never an inline "saved" row, and never both.
  - A failure the reader must act on stays on screen: an `Alert` in the form
    or dialog, with `resolveError(error, fallback).message` from
    `useErrorMessage()`. Never a toast for a failure, never a raw
    `error.message`.
- **Asking first:** anything destructive or irreversible (remove a host,
  stop a session, revoke a token, sign out a browser) goes through
  `ConfirmDialog` or a dialog shaped like `RemoveHostDialog`.
- **Text:** every string the reader sees goes through `t()`, including
  `aria-label`s, loading text and fallbacks.
  - Keys live in `packages/translations/{en,es}/<area>.json`, the same keys in
    both.
  - Then run `pnpm --filter @oppenheimer/translations assemble`.
  - Delete the keys you stop using, from every locale.
- **Labels drawn from data** (a status, a role) are translated for display,
  but anything keyed on the value, such as a colour or an icon, still reads
  the raw value (`HostCard` takes the stored `status` for its dot and the
  translated `state` for its words).
- **Dates and numbers:** `useLocale()` plus the kit's `dateFormatter`,
  `formatMediumDate`, `formatDateTime`, `formatRelativeTime`. Never
  `toLocaleDateString()` without a locale, never an `Intl` formatter built in
  render, and never read `i18n.language` directly.
- **Effects and memo:**
  - An effect goes in `hooks/`, with a one-line comment naming the external
    system it syncs with.
  - No `useMemo`, `useCallback` or `memo` outside `hooks/`; the React
    Compiler is on. `pnpm check:compiler` lists what it silently left
    uncompiled; a new entry on a fast clock is yours to fix.
- **Data:**
  - Never ship a placeholder number or fake row. If the value isn't
    available, render nothing.
  - A new third-party origin goes in `CSP_EXTRA_ORIGINS`.
  - An HTTP call goes through the product package, never a `fetch` in a
    screen.

## 6. Review against the rules

Go through the "Patterns agents get wrong" lists at the end of
`frontend-architecture.md` and of `apps/web/AGENTS.md` item by item. For
anything beyond a small change, run `/frontend-audit diff --base <ref>` over
the branch: it reviews the clocks and re-renders the scripts cannot see,
against the same rule catalog. Then read the feature as the person who will
change it next:

- Which update redraws the most? Type into a field, settle a poll, let a
  minute pass. Does anything outside the component that changed re-render?
- Does any component take a value it only hands on?
- Is there any string, date or number that is not translated or formatted
  with the locale?
- Is there a helper that already exists in the kit, core, the design system
  or another feature? Promote it or import it; never write it a second time.
- Does every destructive action ask first, and does every failure say
  something the reader can act on?
- Does every success have exactly one confirmation?

Fix what this finds before presenting.

## 7. Prove it

Run the checks:

```bash
node .agents/skills/scaffold-feature/scripts/verify-feature.mjs [--module <module>] [--base <ref>]
```

It runs the checks a contributor runs, in order, and stops at the first
failure:

- `pnpm check:structure` (placement, names, the query-stays-home scan and the
  tests that pin it)
- dependency-cruiser for `apps/web` and every frontend package you changed
- Biome over the app, the changed packages and the e2e suite (the
  query-key, `skipToken` and `withCacheOnSuccess` plugins included)
- the typecheck, after building the workspace packages the app reads
- the unit tests of the feature (or the app) and of the changed packages
- the design-system lint and the React Compiler bailouts, as reports

A step whose tools are not installed is reported as skipped, never as passed.

Beyond that:

- **A component whose cost is the point** (a list on a poll, anything typed
  into, anything on a tick) gets a `*-render.spec.tsx` asserting what one
  update renders, one assertion per clock. It runs in the `render-budget`
  project with the compiler off; see `sessions-sidebar-render.spec.tsx`.
- **A screen wired to the API** needs an e2e spec in the web suite
  (`references/templates.md` §9). If an existing spec drives UI you changed
  (labels, headings, URLs), update it in the same change. It needs the stack
  (`/local-stack`); if you cannot run it, say so.

If a check cannot run here, say so and name it. Never claim a check passed
when it didn't run.

## 8. Present the feature

When the task was a **review or a fix**, lead with the findings. List each
one with the rule it broke, where it was, and what you changed; say which
you left alone and why.

End with a short summary:

- The files, grouped by kind, and the module they render.
- The render plan table, with where each hook ended up and what gates each
  action.
- The checks and their results, and every check that did not run with the
  reason, the e2e spec included.
- Decisions worth a second look (what a confirm guards, what is not
  persisted, what was assumed in step 1).
- Follow-ups outside this change: an endpoint still missing, a
  `generate:api-client`, a helper worth promoting once a second consumer
  appears.
