# File names, URLs and the tree they build

The generator turns `src/routes/**` into `src/routeTree.gen.ts`. Two things
come out of a file's name: the **URL** it matches and the **component chain**
that renders it. They move independently, which is the whole point — and the
source of most confusion.

## Every token

| Token | Example file | URL | Effect |
|---|---|---|---|
| `__root.tsx` | `__root.tsx` | — | Always matched, always rendered, wraps the tree. Must sit at the root of `routes/`. |
| plain segment | `about.tsx` | `/about` | |
| `.` separator | `blog.post.tsx` | `/blog/post` | Flat spelling of a nested path; equivalent to `blog/post.tsx`. |
| `index` | `sessions/index.tsx` | `/sessions` | Matches the parent exactly, when no child matches. |
| `$param` | `sessions/$sessionId.tsx` | `/sessions/$sessionId` | Captured into `params`. |
| `$` alone | `files/$.tsx` | `/files/*` | Splat; the rest lands in `params._splat`. |
| `_` **prefix** | `_auth.tsx` | — | **Pathless layout route.** Contributes a component, no URL segment. |
| `_` **suffix** | `posts_.$id.edit.tsx` | `/posts/$id/edit` | **Non-nested route.** Keeps the URL, escapes the parent's layout. |
| `(group)` | `(marketing)/pricing.tsx` | `/pricing` | Grouping folder. Organisation only — no segment, no component. |
| `-` prefix | `-helpers.ts` | — | Excluded from the tree. A colocated helper, not a route. |
| `[x]` | `script[.]js.tsx` | `/script.js` | Escapes a character the conventions would otherwise claim. |
| `route.tsx` | `blog/post/route.tsx` | `/blog/post` | Directory-style spelling of the route at that path. |

## Layout file beside a layout directory

`onboarding.tsx` next to `onboarding/` makes the file the layout for everything
in the directory. This is how `_auth/onboarding.tsx` guards
`_auth/onboarding/*` while `/onboarding` itself is served by
`_auth/onboarding/index.tsx` — which in this app is a `beforeLoad` that
redirects into the first step, and so carries no component at all.

Note that this layout is *not* pathless: `onboarding.tsx` has no `_` prefix, so
it contributes the `/onboarding` segment its children hang from. `_auth` above
it is pathless, which is why `/login` sits at the root. Both shapes appear in
the same tree; read the prefix, not the nesting.

## Pathless layout vs grouping folder

Both keep a segment out of the URL. They are not interchangeable:

- **Pathless layout (`_name.tsx`)** renders a component and can carry
  `beforeLoad`, `validateSearch` and `staticData`. Use it when the routes share
  chrome or a guard.
- **Grouping folder (`(name)/`)** renders nothing and carries nothing. Use it
  when you only want the files near each other.

If you find yourself giving a grouping folder behaviour, you wanted a pathless
layout.

## Worked example: the auth restructure

The move that unified sign-in and onboarding under one layout. Every URL is
unchanged; only the component chain and the guards moved.

Before:

```
_auth.tsx                  guard: redirectSignedIn      →  AuthLayout
  _auth/login.tsx                                       →  /login
onboarding.tsx             guard: signed-in only        →  Outlet
  onboarding/index.tsx                                  →  /onboarding
  onboarding/_flow.tsx                                  →  AuthLayout (a second copy)
    onboarding/_flow/host.tsx                           →  /onboarding/host
```

After:

```
_auth.tsx                  no guard                     →  AuthLayout
  _auth/_public.tsx        guard: redirectSignedIn      →  (no component)
    _auth/_public/login.tsx                             →  /login
  _auth/onboarding.tsx     guard: signed-in only        →  (no component)
    _auth/onboarding/index.tsx                          →  /onboarding
    _auth/onboarding/host.tsx                           →  /onboarding/host
```

Four things to take from it:

- A pathless layout route with **no `component`** is a fine thing to write. It
  defaults to rendering `<Outlet />`, so `_public.tsx` is four lines that exist
  only to hold a guard.
- The guard moved *down* rather than being merged. Two subtrees wanted opposite
  answers, so neither answer belongs on the shared parent.
- `_flow`'s only job was to re-mount the same layout with one prop different.
  That prop became route `staticData`, and the layout route disappeared.
- Unifying chrome makes duplicate *content* obvious, and the refactor is not
  finished until you look. `/onboarding` held a second create-workspace form
  beside the step at `/onboarding/workspace`; under one layout they were
  visibly the same page twice, and the index became a redirect into the step.

## Reading the generated tree

`routeTree.gen.ts` has three maps. The one that answers "did I change a URL" is
`FileRoutesByTo` — the paths you may pass to `Link`/`navigate`:

```bash
sed -n '/interface FileRoutesByTo/,/^}/p' apps/web/src/routeTree.gen.ts
```

`FileRoutesById` shows the full ids including pathless segments
(`/_auth/onboarding/host`), which is what you want when debugging *which*
layout is wrapping a route. `FileRoutesByFullPath` sits between them.
