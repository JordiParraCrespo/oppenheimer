---
name: local-stack
description: Verify a change end to end against the real API, a real runner and the console, and photograph the console for a pull request. Use it on every change that alters what the console shows (apps/web, packages/frontend/web, the web design system, the translations), before the change is committed for a pull request, to take and show light and dark screenshots of each screen it touches. Use it also when a change to apps/runner, the API's relay, links, sessions or hosts modules, or the console's terminal needs more than unit tests, or when asked to run the product and show it working.
---

# Verify a change end to end

## 0. A machine that has never run it

`scripts/dev/bootstrap.sh --check` says what this machine lacks: Node 22,
pnpm, Go, golangci-lint and gh (pinned in `mise.toml`), Docker with compose
and the docker group, Playwright's chromium and ffmpeg, a signed-in gh.
Without `--check` it installs what needs no root; `--sudo` also does Docker
and the browsers' system libraries. A docker group it just added needs a
re-login, which no script can do for you.

## 1. Stand the stack up

```bash
node scripts/stack/stack.mjs up          # add --web when the console is involved
```

It is the "Running it" steps of `e2e/README.md` in one command, and it
leaves the checkout's `.env` and any running Postgres and Redis alone. It
does not need Docker: it uses a Postgres and a Redis already listening on
5432 and 6379, and starts them with Docker only when nothing is. On a
machine with neither (a cloud sandbox), start the local ones first —
`service postgresql start`, then `service redis-server start`, with an
`oppenheimer` role and database matching `.env.example`'s `DB_*` — and run
it. Try it before deciding the stack cannot run here. The
API's log is `.stack/api.log`, which is where the suites read it by default.

## 2. Run what the change touches

| Change touches | Run |
| --- | --- |
| API routes, sessions, hosts, pairing | `pnpm --filter @oppenheimer/e2e e2e:api` |
| The runner's side of the link, the relay | `cd apps/api && RELAY_E2E=1 pnpm exec vitest run src/relay/__tests__/relay.e2e.spec.ts` (no stack needed) |
| Several hosts, sessions on a real runner, flow control, the console's terminal | `pnpm --filter @oppenheimer/e2e e2e:fleet:local` (see `e2e/README.md` for the specs that need `--web`) |
| How the terminal feels over real-world links (latency, jitter, loss, slow uplinks), relay vs direct path | `pnpm --filter @oppenheimer/e2e e2e:netsim` with the stack up `--web` (Linux, root; the `/netsim` skill) |

`e2e:fleet:local` runs the fleet's hosts on this machine, which is what a
machine that cannot build the fleet's image needs; a test that needs a host
to lose its network alone skips there. Where Docker can build the image,
`e2e:fleet` runs the same suite with every host in a container.

In an environment that ships its own Chromium, point Playwright at it with
`PLAYWRIGHT_CHROMIUM_PATH`.

## 3. Show a visual change

Every change that alters what the console shows gets screenshots, taken
here and shown to the user, before its pull request is opened or updated.
What counts is defined once, in `.agents/hooks/visual-change.mjs`: the
console, the platform kit, the design system and the translations, not
their tests, stories or docs. The PreToolUse hook
`.agents/hooks/screenshot-guard.mjs` refuses to push such a branch, or to
open or update its pull request (`gh pr create`/`edit`, the GitHub MCP
tools), until `.screenshots/` is of the code as it is: `pnpm screens`
records a fingerprint of the change's files, and an edit to one of them
after the pictures means taking them again. A turn that ends without
publishing is not held.

1. Bring the stack up with the console: `node scripts/stack/stack.mjs up --web`.
   It serves this checkout's source through Vite, so later edits show
   without a restart.
2. Name the routes the change shows on and photograph them:

   ```bash
   pnpm screens /sessions /settings/profile
   ```

   Each route is taken light and dark, signed in as a fresh account that
   owns a workspace, into `.screenshots/` (git-ignored) with a
   `manifest.json` naming the commit. `anon:/login` takes a signed-out
   route; `--github` connects a stub GitHub installation first, so the
   composer and project screens have repositories; `--phone` adds a 390px
   width, which a layout change needs. A component in the design system or
   the kit is photographed on a console route that renders it.

   A state an empty account cannot reach (a dialog open, a row's menu, a
   host online) is a throwaway spec: write it with the Write tool straight
   to `e2e/tests/screens/local/<name>.spec.ts` (git-ignored, outside
   Biome and the typecheck) and name it among the routes as `spec:<name>`:
   `pnpm screens /sessions spec:dialog`. It imports the helpers
   from `../../../support/` and saves into the repo's `.screenshots/`:

   ```ts
   import { test } from '@playwright/test';
   import { provisionedUser, signInAs } from '../../../support/web';

   test('the delete dialog', async ({ page }) => {
     const owner = await provisionedUser('screens');
     await signInAs(page, owner.user);
     await page.goto('/sessions');
     // …reach the state…
     await page.screenshot({ path: '../.screenshots/dialog-1440-light.png' });
   });
   ```

   Leave the file there; there is nothing to clean up. Never write it
   elsewhere and copy, `sed` or `rm` it into place.

   **No prompts.** Every command this skill names but the relay row is
   allowed in `.claude/settings.json`; run each as written, one per call. Chaining
   with `&&`, a pipe, a `cd` first or a variable in front makes a different
   command, and that one asks.

A change in those paths that does not show on screen (a renamed prop, a
hook's internals) skips this: say why with
`pnpm screens --not-visual "<why>"`, which records it with the same
fingerprint, and put the same line under `## Screenshots`.

## 4. Report and tear down

Report which rows you ran, what they printed, which screenshots you took,
and what you did not run and why. Then:

```bash
node scripts/stack/stack.mjs down
```
