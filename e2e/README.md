# @oppenheimer/e2e

End-to-end coverage for authentication, driven by Playwright against a running
stack. Two projects share one runner:

- **`api`** — drives the Better Auth endpoints and the REST routes behind them
  with `request` only, so it needs no browser.
- **`web`** — drives `apps/web` in Chromium, exercising the same journeys
  through the UI a user actually sees.

## Where it runs

CI runs the **`api` project** on every pull request, in the `End-to-End Tests
(API)` job: Postgres and Redis as service containers, migrations, the API
started from its build, then `e2e:api`. No browser is involved, so that job
needs none.

The **`web` project does not run in CI yet, and does not pass.** On `main` it is
15 failures out of 64, and they are not flakes — the suite drifted while nothing
ran it:

- six `team.spec.ts` specs, and the profile spec that opens the team page, drive
  a `/team` route that `apps/web` no longer has. Organization surfaces now live
  in `apps/web/src/features/organizations/` — the onboarding and
  accept-invitation screens, and the general pane of `/settings` — while roles
  and users moved to the control plane (`apps/admin-web`, over
  `@oppenheimer/frontend-admin`). The specs did not follow
- `nav-permissions.spec.ts` asserts a nav catalog that has the same problem
- the rest — an avatar upload, a password change signing other devices out, a
  wrong-password error, the language switch — are individually stale or broken
  and need diagnosing one at a time

Fixing that is its own piece of work: port the specs to whichever app owns each
surface now, then add `--project=web` to the CI job. Until then a green CI says
nothing about the browser journeys, so run `pnpm --filter @oppenheimer/e2e e2e:web`
locally when you touch them.

## The two stubs, and what they are for

Two of the console's surfaces talk to something this repository does not own,
and a deployment here has neither — so `support/` carries a stand-in for each,
and the API is pointed at them when the stack is started. **Nothing else in a
run is faked**: the browser, the console, the API's guards, its Zod pipe, its
problem-document filter and its Postgres are all the real ones.

| Stub | Stands in for | Pointed at by | Why it cannot be real |
| --- | --- | --- | --- |
| `support/github-stub.ts` | GitHub's REST API | `GITHUB_APP_API_URL`, `GITHUB_APP_OAUTH_URL` | Repositories and branches are answered live through a GitHub App installation. Without an App, `POST /sessions` cannot validate a repository and New session has nothing to pick |
| `support/namer-stub.ts` | The model that names a session | `SESSION_NAMER_BASE_URL` | The namer is an OpenAI-compatible server (Groq, vLLM, a local Ollama). Its stub answers a title derived from the prompt it was given, so a request carrying the wrong text fails visibly |

Both run before the API, because the API reads their URLs at boot — and the
configuration that points it at them is generated rather than committed, since
it includes a GitHub App key and a control-plane signing key:

```bash
node --experimental-strip-types e2e/support/stub-env.ts >> .env   # keys, per run
node --experimental-strip-types e2e/support/github-stub.ts &      # :4319
node --experimental-strip-types e2e/support/namer-stub.ts &       # :4320
```

CI does exactly this in the `End-to-End Tests (API)` job, which is why the
sessions create path runs there now instead of skipping: it needed a connected
installation, and a deployment with no App has none.

The GitHub stub has one endpoint GitHub does not:
`PUT /__stub/installations/{id}` claims an installation id. Each test claims its
own, because connecting an installation is exclusive to a workspace and a second
claim is `GITHUB_003` — the product's rule, not something a test works around.
`support/sessions.ts` wraps that, along with pairing a host through the real
mint-and-redeem flow.

An environment that already ships a Chromium — a container image, a sandbox —
can say where it is instead of downloading the build this Playwright pins:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e:web
```

## The fleet: real runners, several machines

`tests/fleet/` is a third project, and the only one where a host is a real
runner rather than a keypair and a row. Each host is a Debian container
(`fleet/Dockerfile`) with its own Unix account, home, tmux server and host key,
running the runner binary built from this checkout. It pairs through `runner
register` with a token minted by the API, holds the link, clones from a
`git daemon` container seeded with the repositories the GitHub stub lists, and
runs sessions in tmux. The only fake on a host is `claude`, a shim that prints
its argv and hands the pane to a shell.

What it covers: three machines on one account, each session running on the
machine it names (the shell prints its own hostname through the relay); one
machine losing its network going offline alone and coming back to the same
screen; a runner killed with SIGKILL, restarted by the supervisor, adopting its
tmux sessions; another account neither seeing a machine nor starting anything
on it.

```bash
# with the API and the stubs running as below, plus Docker and Go:
pnpm --filter @oppenheimer/e2e e2e:fleet     # builds the image, ~1 minute
KEEP_FLEET=1 pnpm --filter @oppenheimer/e2e e2e:fleet   # leave the hosts up afterwards
docker ps --filter label=dev.oppenheimer.fleet=1
docker exec -it <host> fleet-host cut|restore|kill-runner
```

It is opt-in (`E2E_FLEET=1`, which `e2e:fleet` sets), so `e2e` and `e2e:api`
never select it. Two things about the hosts are deliberate:

- **The API is reached on the host's loopback.** The runner speaks plain HTTP
  only to loopback, so each container forwards `127.0.0.1:3001` to the API with
  `socat`, and that forwarder is the host's network cable: `fleet-host cut`
  pulls it, existing connections included.
- **The host's name is the one its token was minted with**, because that is the
  name the API keeps. `uniqueHostName()` makes one per worker and rerun.

Design and the tiers above it (a lab on real macOS and Linux, a staging
control plane): `product/versions/mvp/12-test-fleet.md`.

## Running it

```bash
# 1. infrastructure
pnpm docker:up                       # Postgres + Redis
cp .env.example .env                 # EMAIL_PROVIDER=console is what the suite reads

# 2. build + migrate + start the API, capturing its log (see "Mailbox" below)
pnpm build
pnpm --filter @oppenheimer/api migration:run
node apps/api/dist/main.js > /tmp/api.log 2>&1 &

# 3. the web app (only needed for the `web` project)
pnpm --filter @oppenheimer/web dev &

# 4. the tests
pnpm test:e2e                              # everything (from the repo root)
pnpm --filter @oppenheimer/e2e e2e:api           # API only, no browser needed
pnpm --filter @oppenheimer/e2e e2e:web           # browser only
pnpm --filter @oppenheimer/e2e e2e:ratelimit     # see "The rate-limit test" below
```

Overridable via environment: `API_URL` (default `http://localhost:3001`),
`WEB_URL` (`http://localhost:3000`), `API_LOG` (`/tmp/api.log`).

Database settings are **not** a separate knob. `support/db.ts` imports
`@oppenheimer/env/load` and reads the same `DB_HOST` / `DB_PORT` / `DB_USERNAME` /
`DB_PASSWORD` / `DB_DATABASE` from the root `.env` that the API and the
migrations use, so the suite cannot end up asserting against a different
database from the one under test — which would turn every DB-backed assertion
into a meaningless pass. To point at another database, change those variables
(a real environment variable always wins over the file), exactly as you would
for the API.

## No mail server needed

Two flows depend on a link that normally arrives by email. The suite reads them
from where the API already puts them, so there is nothing to install:

- **Password reset** — the token lives in Better Auth's `verification` table,
  as `reset-password:<token>` in the `identifier` column. `support/db.ts` reads
  it.
- **Email verification** — the token is a signed JWT that is never stored, so
  `support/mail.ts` reads it out of the API log instead. With
  `EMAIL_PROVIDER=console` the API's `ConsoleEmailService` logs every message it
  would have sent, which makes the log the mailbox. That is why step 2 above
  redirects the API's output to a file, and why `API_LOG` must point at it.

## Accounts and workspaces

Registering creates an account and nothing else: an account belongs to no
workspace until it creates one from `/onboarding` or accepts an invitation. The
`web` specs therefore start from `provisionedUser()` in `support/web.ts`, which
signs up **and** creates a workspace through the API, so a spec spends its time
on the screen it is about rather than on the two screens before it. Only the
specs about registration and onboarding go through those screens themselves.

Every browser spec mints its own account, so the `web` project runs fully in
parallel and nothing has to be put back afterwards.

## Two conventions worth knowing

**Every test here asserts behaviour the app actually has.** Earlier revisions
carried `test.fail()` annotations naming open security issues (#68, #111, #112);
those are fixed and the annotations are gone. If you add one for a new bug, name
the issue in it — the test then reports green while the bug is present and turns
**red when it is fixed**, which is the signal to delete the annotation.

**Requests carry an `Origin` header.** Better Auth refuses a cookie-bearing
state change that arrives without one (`MISSING_OR_NULL_ORIGIN`) — its CSRF
defence. Browsers always send one; a bare API client does not, so `newContext()`
in `support/auth.ts` sends the web app's origin, which the API trusts. A new
helper that builds its own request context needs the same header.

## The rate-limit test

`the API throttles a flood of requests @ratelimit` deliberately trips the global
per-IP limiter (100/minute), which would then refuse every other test sharing
that IP. It is excluded from the default run by `grepInvert` and has its own
script:

```bash
pnpm --filter @oppenheimer/e2e e2e:ratelimit
```

Token minting is separately throttled to 10/minute, so `mintToken` waits out a
429 rather than failing — the limiter has its own test and should not be
re-tested by accident everywhere else.

## Layout

```
e2e/
├── support/
│   ├── auth.ts     # request contexts, sign-up/in/out, reset helpers, problem-doc assertions
│   ├── db.ts       # reset tokens, roles, orgs, sessions, password hashes
│   └── mail.ts     # reads the console-provider "mailbox" out of the API log
└── tests/
    ├── api/        # sign-up, sign-in, password reset, verification, protected
    │               # routes, authorization, API tokens, session security, OAuth
    └── web/        # the same journeys through apps/web in Chromium
```
