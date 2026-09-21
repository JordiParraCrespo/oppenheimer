---
name: tanstack-routing
description: Routing in the Oppenheimer Vite apps (apps/web, apps/admin-web), which use TanStack Router with file-based routing. Use this whenever you add, move, rename, split or delete a route file; add or change a route guard, redirect, layout route or search param; touch routeTree.gen.ts, beforeLoad, validateSearch, staticData or the router context; or debug a 404, a redirect loop, a route that renders the wrong layout, or a URL that changed when it should not have. Also use it when the user asks about the route tree, URL structure, protected or authenticated routes, sign-in redirects, or where a screen should live — even if they never say "router".
---

# Routing in the Vite apps

`apps/web` and `apps/admin-web` are TanStack Router SPAs with file-based
routing: the files under `src/routes/` *are* the route tree, and
`src/routeTree.gen.ts` is generated from them. `apps/mobile` and
`apps/admin-mobile` use expo-router and are not covered here.

The single most expensive mistake in this area is changing a URL by accident.
File-based routing means a rename is a URL change, and URLs are in bookmarks,
in e2e specs, in emails the API sends and in `Link`s across the app. Before you
move any route file, know what URL each file produces — and afterwards, prove
the set of URLs is what you intended by reading `FileRoutesByTo` in the
regenerated tree.

## Where things are

```
apps/web/src/
├── app.tsx             createRouter, the RouterContext type, the auth subscription
├── routeTree.gen.ts    GENERATED — never edit by hand
└── routes/
    ├── __root.tsx      NuqsAdapter + PageViewTracker, no guard
    ├── index.tsx       /  → redirects to /sessions or /login
    ├── _auth.tsx       the split screen (AuthLayout + panel), no guard
    ├── _auth/
    │   ├── _public.tsx     guard: signed-in → /sessions; no component
    │   ├── _public/        login · register · forgot-password · reset-password
    │   ├── onboarding.tsx  guard: signed-out → /login; no component
    │   └── onboarding/     index (redirects to workspace) · the four steps
    ├── _authenticated.tsx  guard: signed-out → /login; AppShell + its 404/error
    ├── _authenticated/     sessions/ · settings/ · profile · $ (console catch-all)
    └── about · privacy · terms · oauth/consent   (public, no layout)
```

`apps/admin-web` is the same shape with one product: `_auth` (guarded by
`redirectSignedIn` directly, since it has no onboarding half) and
`_authenticated`.

## The rules that catch most mistakes

**A route file composes; it does not contain.** It holds the `Route`
(`beforeLoad`, `validateSearch`, `staticData`, `component`) and a small
component that mounts a screen from `src/features/<module>/screens/` or
arranges sections. `pnpm check:structure` caps it at 120 lines, and
dependency-cruiser's `routes-compose` rule forbids importing a feature's
`forms/`, `components/` or `hooks/` — a route reaching into those is a screen
that has not been written yet.

**The layout route and the guard are different jobs.** A layout route exists to
render chrome; a guard exists to decide who may be here. Put the guard on the
narrowest route that owns that decision. When one layout serves subtrees with
opposite answers — `_auth` wraps both the sign-in screens, which turn signed-in
visitors away, and onboarding, which turns signed-out ones away — the layout
carries no guard and each subtree gets a pathless child that carries its own.
Stacking both onto the shared parent is how you get a redirect loop.

**`validateSearch` replaces the route's search.** Whatever it returns *is* the
search; a key it does not return is gone by the next navigation. A route that
only cares about one key must still spread the rest through, or it silently
deletes another component's state — `routes/_authenticated/settings/index.tsx`
is the worked example, and `__root.tsx` explains why nuqs depends on it.

The wider TanStack advice is to write these as Zod schemas with defaults, which
buys real type safety. Weigh it here against the bundle: `validateSearch` is
critical-path code that `autoCodeSplitting` will not split out, and `apps/web`
must not pull runtime values from the `@oppenheimer/shared` root. A narrow
schema from a subpath is fine; a hand-rolled validator, as the routes use
today, is also fine. `pnpm check:bundle` is the arbiter.

**`to` is a pathname, never a URL with a query.** `to: '/settings?section=security'`
puts the whole string in the pathname and 404s. Split it and pass `search`
separately — `routes/_auth/_public/login.tsx` does this when sending a reader
on after sign-in.

**`routeTree.gen.ts` is generated.** Never hand-edit it, and never leave it
stale: the app's `build` is `tsc -b && vite build`, so a tree that disagrees
with the route files fails typecheck before Vite ever runs. Regenerate with
`node .agents/skills/tanstack-routing/scripts/generate-route-tree.mjs apps/web`
(seconds, no build) or by running the app's `dev`/`build`, then commit it.

## File name → URL

| File | URL | Notes |
|---|---|---|
| `__root.tsx` | — | always matched, wraps everything |
| `about.tsx` | `/about` | |
| `sessions/index.tsx` | `/sessions` | matches the parent exactly |
| `sessions/$sessionId.tsx` | `/sessions/$sessionId` | `$` is a param; `Link to="/sessions/$sessionId" params={{ sessionId }}` |
| `_auth.tsx` + `_auth/login.tsx` | `/login` | `_` prefix: **pathless layout**, wraps without a URL segment |
| `onboarding.tsx` + `onboarding/host.tsx` | `/onboarding/host` | a file beside a directory of the same name is that directory's layout |
| `posts_.$id.edit.tsx` | `/posts/$id/edit` | `_` **suffix**: un-nests from the parent's layout |
| `(marketing)/pricing.tsx` | `/pricing` | parens: grouping folder, no URL segment |
| `-helpers.ts` | — | `-` prefix: excluded from the tree entirely |

Nesting composes both ways: `_auth/onboarding/host.tsx` renders
`__root → _auth → onboarding → host` while its URL is only `/onboarding/host`,
because `_auth` contributes a component and no segment. That is the tool for
"same chrome, different URLs" — reach for it before duplicating a layout.

`references/file-conventions.md` has the full table, the escaping rules and
worked before/after examples of moves that keep URLs stable.

## Guards and the auth context

Guards read `context.auth.isAuthenticated` in `beforeLoad` and throw a
`redirect`. Three facts about this app make them behave:

1. **`beforeLoad` runs parent-first, and only when the router re-runs it.** It
   is not a subscription. `app.tsx` subscribes to the auth store at module
   scope, hands the router the new context *before* calling
   `router.invalidate()`, and skips invalidation while the router is unmounted
   — read the comment there before changing any of it.
2. **Session restore gates the router, not the guards.** A returning reader's
   token is in localStorage, so `AppRoutes` holds the router behind
   `useSessionRestore()`'s `isPending`. Without that gate every signed-in cold
   load bounces to `/login` and back.
3. **A guard is chrome, not authorization.** The API authorizes every request
   independently. A route guard only saves the reader from a screen that would
   refuse them.

For "signed in, but send them on", use `redirectSignedIn` from
`@oppenheimer/frontend-web` rather than writing the check again: it honours a
`?redirect=` and sanitises it. Any redirect target that came from a URL must go
through `sanitizeRedirect` — an absolute or protocol-relative value is an open
redirect, and the helper exists because two call sites once checked different
things.

## Configuring a layout from its pages

When a layout needs to vary per page, the page declares route `staticData` and
the layout reads it off the innermost match — the page overrides its layout
without reaching up into it.

Two layouts do this, each augmenting `StaticDataRouteOption` with a
`declare module` block beside the code that reads it, so a key and its only
consumer stay together: `AuthLayout` reads `authWidth` and `legalNoteKey`,
and `AppShell` reads `pane` (`measure` or `full`) through `resolveContentPane`
in the kit's `shell/lib/pane.ts`. Adding a key means adding it next to its
reader, not to a shared types file.

Three things to get right, each of which this layout got wrong first:

- **Read one walk, not one per key.** A single `useMatches` whose `select`
  returns the whole framing object beats a subscription per key. It is also
  the only shape that typechecks cleanly: a helper generic over the staticData
  key cannot be resolved by the router, so its selector's return type widens to
  include the match array.
- **Test "declared", not "truthy".** `'key' in staticData` — or `!== undefined`
  where no falsy value is meaningful. Otherwise a legitimate `null` or `false`
  reads as "this page said nothing" and the layout inherits.
- **Give a key its own states rather than adding a flag beside it.**
  `legalNoteKey` is `undefined` (the default line), a key (that line) or `null`
  (no line). A separate boolean for "off" would be a second key that exists
  only to be `false`, and a branch in the layout to match.

## Code splitting, preloading, and the loader decision

`autoCodeSplitting` is on, so each route's `component`, `errorComponent` and
`pendingComponent` are their own chunk while `beforeLoad`, `validateSearch`,
`staticData` and `loader` stay in the critical bundle. That is why guards cost
nothing and why a fat route file costs everyone. The critical path is budgeted
— `pnpm check:bundle` is where a heavy import shows up.

`defaultPreload: 'intent'` fetches a route's chunk on hover or focus, after a
50ms delay. Because no route here carries a `loader`, that prefetches code
only.

**No route has a `loader`, deliberately.** Every screen reads through TanStack
Query, and `defaultPreloadStaleTime: 0` hands freshness entirely to it rather
than running a second, disagreeing staleness rule. Know that this is a real
trade, not an oversight: upstream guidance is to preload a screen's critical
data in the loader with `queryClient.ensureQueryData` so navigation lands on
data instead of a spinner, and this app accepts the spinner to keep one cache
and one rule. If you add the first `loader`, that is an architectural change,
not a route change — put the `queryClient` on the router context, say why the
router should own that data, and revisit `defaultPreloadStaleTime` in the same
diff.

## Not-found and error boundaries

Both exist; do not rebuild them. `__root.tsx` carries an `errorComponent` and
a `notFoundComponent` for a URL outside any layout, and `_authenticated.tsx`
carries its own pair so a 404 or a thrown render inside the console keeps the
shell and sidebar around it. `_authenticated/$.tsx` is the catch-all that
routes an unknown console URL into that same screen.

`notFoundMode` defaults to `fuzzy`, which is what renders the 404 at the
closest match with a boundary rather than replacing the whole page. For "this
id does not exist", throw `notFound()` from the route's `beforeLoad` or loader
and let the layout's boundary catch it.

## What these apps still do not have

Worth knowing before you assume a mechanism exists, and worth proposing rather
than quietly adding, since each is app-wide:

- **No `useBlocker`.** That is the tool for a form with unsaved changes, and
  it drives the browser's own `beforeunload` too.
- **No scroll restoration** configured.

## Verify before you push

```bash
node .agents/skills/tanstack-routing/scripts/generate-route-tree.mjs apps/web
pnpm turbo run build --filter=@oppenheimer/web   # tsc -b + vite; the real check
pnpm --filter @oppenheimer/web arch              # routes-compose and friends
pnpm check:structure                             # the 120-line route cap
pnpm check:bundle                                # needs a build of both web apps
pnpm starter:check                               # if you named an optional app
```

If you moved or renamed anything, also diff the URL surface — this is the check
that catches an accidental URL change, and nothing else does:

```bash
sed -n '/interface FileRoutesByTo/,/^}/p' apps/web/src/routeTree.gen.ts
```

Then grep the repo for the URLs you touched: `e2e/tests/web/` asserts on them,
and so do `Link`/`Navigate`/`redirect` call sites and `src/lib/nav.ts`.

## Recipes

`references/recipes.md` walks through the moves that come up: adding a route,
adding a guarded subtree under an existing layout, restructuring without
changing URLs, adding a search param that survives other routes, sending a
reader on after sign-in, and what to do when the generator and the build
disagree.
