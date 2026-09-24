---
name: local-stack
description: Run Oppenheimer end to end on this machine — Postgres and Redis in Docker, the GitHub and namer stubs, the migrated API, the console, and a real runner host paired through the real API with sessions running in tmux — then verify a change against it. Use this whenever the user asks to run, start, launch, try or screenshot the app, to verify a change "locally" or "for real", to test the relay, the runner link, attach sockets, terminals, pairing or sessions end to end, or when a change to apps/runner, the API's relay/links/sessions/hosts modules, or the console's terminal needs more than unit tests. Also use it in a cloud sandbox where Docker is installed but not running, or where the fleet's container image cannot be built.
---

# The local stack

`scripts/stack/stack.mjs` stands up the whole product on this machine and
records everything it starts under `.stack/`. This skill is when to use it,
what to run against it, and what goes wrong.

```bash
node scripts/stack/stack.mjs up --web     # Docker, Postgres, Redis, stubs, API, console
node scripts/stack/stack.mjs host         # a real runner, paired with a fresh account
node scripts/stack/stack.mjs status       # what is up; the host's credentials
node scripts/stack/stack.mjs down         # stop it all (--purge: volumes, host account, .stack/)
```

`up` is idempotent and leaves anything already answering on its port alone.
Drop `--web` when no browser is involved; `--no-build` skips the API build
when `dist/` is current. `host` prints the account it signed up (email and
password, also in `.stack/host.json`): sign in to `http://localhost:3000`
with it to see the host and its sessions in the console.

Logs are `.stack/<name>.log`: `api`, `web`, `runner`, `github-stub`,
`namer-stub`, `git-daemon`, `dockerd`. Read `runner.log` and `api.log`
first when a session does not start or a terminal does not attach.

## What is real and what is not

Real: Postgres, Redis, the API with its guards and relay, the console, the
runner binary built from this checkout, `runner register` redeeming a token
minted through `POST /hosts/pairing`, the link, tmux, `git clone` into a
worktree, the attach sockets and the credit window.

Stubbed, the same three things the rest of `e2e/` stubs and nothing more:

| Stub | For | Why |
| --- | --- | --- |
| `e2e/support/github-stub.ts` | GitHub's REST API | There is no GitHub App here; sessions validate repositories through it |
| `e2e/support/namer-stub.ts` | the model that names a session | An OpenAI-compatible server this repo does not own |
| a local `git daemon` | `github.com` for git | The host's git config rewrites `https://github.com/` to it, so the runner clones what it always clones |

`claude` on the host is `e2e/fleet/claude`: it prints its argv and hands the
pane to `sh -i`, so a test can type into a session and see it answer.

## Verifying a change

Pick by what the change touches, cheapest first:

| Change touches | Run |
| --- | --- |
| API routes, sessions, hosts, pairing | `pnpm --filter @oppenheimer/e2e e2e:api` (only `up` needed) |
| The relay, the link, the runner's link or attachments | `cd apps/api && RELAY_E2E=1 pnpm exec vitest run src/relay/__tests__/relay.e2e.spec.ts` (needs Go, tmux, git; no stack) |
| Many sessions on one host, flow control, latency, a flood | `pnpm --filter @oppenheimer/e2e e2e:local` (`up` + `host`) |
| The console's terminal, `SessionStream`, xterm | the same `e2e:local` (runs `local-web` too; `up --web` + `host`) |
| Anything a person would see | sign in with the host's account and drive it in Chromium |

`e2e:local` is `e2e/tests/local/`: `link.spec.ts` opens ten sessions on the
host, checks they share **one** connection to the API, measures keystroke
echo while three other panes each print ~40 MB, and checks the floods finish
and still answer. `console.spec.ts` opens a session in the console and types
into it. Both log their numbers; quote them when reporting.

In a sandbox that ships Chromium outside Playwright's cache, say where:
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium`. The e2e suites read
the API log for emailed links: pass `API_LOG=.stack/api.log`.

To exercise a runner restart or an API restart, kill the process by the pid
in `.stack/pids.json` (the group: `kill -- -<pid>`) and start it again with
`up`; the runner redials on its own and `runner.log` shows the new epoch.

## When the fleet is the better tool

`e2e:fleet` (`e2e/support/fleet.ts`) runs several hosts in containers and can
cut a host's network or SIGKILL its runner. Prefer it wherever Docker can
build images. The local stack is one host on this machine: use it when the
fleet's image cannot be built (below), or when one host is all the change
needs.

## What goes wrong, and why the script does what it does

- **Docker is installed but no daemon runs.** Cloud sandboxes ship `dockerd`
  without starting it; as root, `up` starts it and logs to
  `.stack/dockerd.log`. Anywhere else, start Docker yourself.
- **Docker Hub answers 429.** Anonymous pulls from a shared address are rate
  limited. `up` falls back to `mirror.gcr.io` and `public.ecr.aws`, which
  serve the same official images, and retags them to the names the compose
  file uses.
- **The fleet's image cannot be built in a sandbox.** Its `apt-get` needs the
  internet, and a sandbox's egress proxy usually listens on loopback, where a
  build container cannot reach it. Do not expose the proxy to containers to
  get around this; that is what the local host is for.
- **`runner register` refuses root.** As root, `host` creates an
  `oppenheimer-host` account and runs the runner as it, which is also the
  shape of a real machine (one Unix user owns the runner, its tmux server and
  its checkouts). As any other user it runs as you with `HOME` under
  `.stack/host-home`, so it never touches your real `~/.oppenheimer`.
- **A pane stalls after 256 KB in a test.** That is the credit window working:
  something has to send `{"type":"credit"}` for what it read. The fleet's
  `attach` helper does not credit; `openTerminal` in
  `e2e/support/local-host.ts` does. Use it for anything that prints a lot.
- **`.env` gets the stub keys once.** `up` appends `stub-env.ts`'s output only
  if its marker is absent. A second set would re-key the control plane and
  orphan every paired host; if that happens, `down --purge` and start over.
- **`pkill -f <pattern>` kills the shell running it** when the pattern also
  appears in that command line. Stop things by pid (`.stack/pids.json`) or
  with `down`.
- **Pairing is rate limited per address** (the product's rule, F5). A few
  hosts a minute is fine; a loop that pairs many trips it. Wait it out.

## Reporting

Say which rows of the table above you ran and what they printed, which
parts you did not run and why (no browser, no Docker), and anything the
script had to work around. A local run is evidence, not CI: the PR still
needs its checks.
