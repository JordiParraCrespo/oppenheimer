---
name: local-stack
description: Verify a change end to end against the real API, a real runner and, when it matters, the console. Use when a change to apps/runner, the API's relay, links, sessions or hosts modules, or the console's terminal needs more than unit tests, or when asked to run the product and show it working.
---

# Verify a change end to end

## 1. Stand the stack up

```bash
node scripts/stack/stack.mjs up          # add --web when the console is involved
```

It is the "Running it" steps of `e2e/README.md` in one command, and it
leaves the checkout's `.env` and any running Postgres and Redis alone. The
API's log is `.stack/api.log`, which is where the suites read it by default.

## 2. Run what the change touches

| Change touches | Run |
| --- | --- |
| API routes, sessions, hosts, pairing | `pnpm --filter @oppenheimer/e2e e2e:api` |
| The runner's side of the link, the relay | `cd apps/api && RELAY_E2E=1 pnpm exec vitest run src/relay/__tests__/relay.e2e.spec.ts` (no stack needed) |
| Several hosts, sessions on a real runner, flow control, the console's terminal | `FLEET_HOSTS=local pnpm --filter @oppenheimer/e2e e2e:fleet` (`console.spec.ts` needs `--web`) |

`FLEET_HOSTS=local` runs the fleet's hosts on this machine, which is what a
machine that cannot build the fleet's image needs; a test that needs a host
to lose its network alone skips there. Where Docker can build the image,
drop the variable and the same suite runs every host in a container.

In an environment that ships its own Chromium, point Playwright at it with
`PLAYWRIGHT_CHROMIUM_PATH`.

## 3. Report and tear down

Report which rows you ran, what they printed, and what you did not run and
why. Then:

```bash
node scripts/stack/stack.mjs down
```
