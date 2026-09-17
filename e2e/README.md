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
