# `qa/` — the scenario pack

A QA pass over this product, kept in version control: what we claim the app
does, an environment to check it in, the data to check it against, and the
screenshots that show what actually happened.

It is deliberately not a second unit-test suite, and not a second `e2e/`. Those
answer "did this function keep its contract" and "did this journey regress";
this answers "if a person signed up this morning, would the first screen tell
them the truth". Those questions need different equipment, so this has its own
runner, its own fixtures, and its own idea of what a failure is.

The shape is ported from two places: the scenario-pack layout, coverage ids and
`qa coverage` come from [OpenClaw](https://github.com/openclaw/openclaw)'s `qa/`,
and the product-shaped fixtures, the recorder and the screenshot rules come from
the same pack in the CRM repo this codebase is a sibling of.

## The shape of it

```
qa/
├── scenarios/            # what we claim, in YAML — the source of truth
│   ├── index.yaml        # environment, fixture catalog, themes, principles
│   └── auth/*.yaml
├── taxonomy.yaml         # the coverage ids a scenario may claim
├── specs/                # how each claim is checked, in Playwright
├── fixtures/             # the database states scenarios run against
├── src/                  # the runner: loader, recorder, reporter, CLI
├── bin/qa-env.sh         # the simulation environment
└── artifacts/            # screenshots, report, results (not committed)
```

A scenario is a YAML file. A spec binds to it by id — `scenario('AUTH-01', …)` —
and that call is the only thing that registers an implementation. So adding a
case later is: write the YAML, write a spec that names its id. Nothing else has
to be edited, and `qa coverage` will list a scenario nobody has implemented
rather than letting it sit quietly inside a green run.

## Running it

```bash
qa/bin/qa-env.sh up                # Postgres, Redis, the API, both web apps
pnpm qa:suite                      # every scenario
pnpm qa:coverage                   # the inventory
pnpm qa coverage --match auth.ts   # which scenario proves a file still works
pnpm qa suite --theme auth         # one theme
pnpm qa fixture baseline           # one fixture, by hand
pnpm qa publish qa-auth-pass       # copy this run's evidence into docs/
```

`qa-env.sh` prefers `pnpm docker:up` for the datastores and falls back to a
locally installed Postgres and Redis when the docker CLI is present but no
daemon answers — which is the situation in most sandboxes and some CI images.
Either way it ends at Postgres on 5432, Redis on 6379, the API on 3001, the
consumer app on 3000 and the control plane on 3003, with migrations run and the
platform seed applied.

Every run writes `artifacts/report.md` (a readable account, with the screenshots
inline), `artifacts/results.json` (the same thing for a machine) and
`artifacts/screenshots/`.

## Two apps, not one

`apps/admin-web` is a separate application on a separate port, not a route of
`apps/web`. A question like "what can this person do here" has two answers, so
the harness carries both URLs and opens the control plane in its own browser
context — sharing one would turn every cross-app check into a question about
cookie leakage. A scenario asks for it with `openAdmin()`, which is lazy: most
scenarios never touch it, and a second context each is not free.

## Fixtures

Five database states, each owning its own workspace, so they can exist side by
side and a scenario picks one by signing in as the right person:

| fixture    | what it is                                       | why                                                                       |
| ---------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| `baseline` | 12 members, 3 teams, 4 pending invitations       | every region of a roster screen has something real behind it              |
| `volume`   | 2,000 members, 60 teams, 300 invitations         | what only breaks at scale — and the other tenant in the isolation check   |
| `empty`    | one member, nothing else                         | the state most likely to render a zero as if it were a measurement        |
| `roster`   | one holder of each kind of person, including one platform admin | lets "what can this person do" be asked by signing in           |
| `reset`    | no leftovers from the pack's transient accounts  | the auth scenarios create people, so they must be able to create them again |

Applying a fixture rebuilds rather than tops up, so a rerun after an interrupted
attempt starts where a first run does.

Three details worth knowing before writing another one:

- **The workspace is made through the product's own door.** `POST /v1/organizations`
  is what grants the creator the org-scoped `owner` role, and that role is
  narrowed to the active organization by design. A fixture that inserted the
  rows itself would produce an owner with no ability at all, or would have to
  invent a role and then measure the pack's fiction instead of the product.
- **The fixture owner is a tenant owner, not a platform one.** A `user.role` of
  `admin`/`superadmin` is a platform identity that bypasses tenant scoping. An
  owner holding one would read every workspace's rows, and AUTH-06 would be
  green whatever the product did. The one deliberate exception is the roster's
  platform administrator, who exists precisely to be the person the control
  plane lets in.
- **Sign-up goes through HTTP, never SQL.** Only the endpoint hashes the
  password the way sign-in will later verify it; a fixture that writes its own
  hash produces accounts nobody can log into.

## Mail

There is no mail server. `EMAIL_PROVIDER=console` makes the worker log each
transactional message — `[PASSWORD RESET] To: … | URL: …`, `[INVITATION] … URL: …`
— and `src/mail-sink.ts` reads the links back out of the API log. That log is
the inbox. Because it is append-only across runs, always take the count first
and wait for one _more_ than that; a bare "latest link for this address" will
happily hand back the link the previous run sent, and the scenario then passes
against a token that is already spent.

## Coverage ids

`taxonomy.yaml` lists every id a scenario may claim, and the loader refuses an
id that is not in it — an id nobody can look up reads as proof in the report and
matches nothing in a search. A scenario claims an id as `primary` only when it
executes the boundary that id names; anything else is `secondary`.

This is what makes `qa coverage --match <query>` useful. After touching a file,
that query searches ids, titles, docs refs and code refs and prints the
scenarios that claim to prove it still works. `qa coverage` with no query also
names every id nothing primarily proves, which is the gap worth reading.

## What counts as a failure

Beyond the obvious, the pack refuses to call these a pass — they are in
`scenarios/index.yaml` as the standing principles:

- A placeholder number is a failure. A screen with no data must say so, not
  render a zero that reads like a measurement.
- An error must be legible, and a refusal must read differently from a breakage.
  A blank shell, a spinner that never resolves, and a bounce back to the login
  form are all ways to fail a check that only asks "is the table absent".
- A screenshot is the evidence. A scenario that passes without one has been
  asserted, not verified — the reporter fails any scenario that did not produce
  the captures its YAML promised.

## Writing a scenario

Checks come in two kinds, and the difference matters:

- `qa.check(label, ok, detail)` records and carries on. Use it for findings. A
  QA pass wants every problem a scenario can surface, not just the first one —
  and a recorded failure still fails the run, so nothing hides.
- `expect(...)` stops the scenario. Use it only when there is genuinely nothing
  left to check: the fixture is missing, the platform seed never ran.

`qa.note(text)` puts context in the report — a timing, a payload shape, a
caveat. `qa.shot(page, name, caption)` and `qa.shotOf(locator, …)` take the
evidence.

## The screenshots are a laptop

Every shot is taken at **1440×900 at 2× scale** — 16:10, the most common laptop
logical resolution, written out as a 2880×1800 retina PNG. The evidence is meant
to show what a person actually sees in one glance, and a screenshot of a window
nobody owns is a weaker answer to "what does this screen look like".

Nothing is cropped silently. `qa.shot` measures the app's scroll container after
every capture and, when there is more below the fold, writes it into the report
as a note:

```
> auth-01-superadmin-dashboard: 107px of this screen sat below the fold at 1440×900
```

That is worth reading rather than hiding: a screen that does not fit a laptop is
a finding about the screen, not about the harness. When a scenario needs to
evidence a particular band of the page, `qa.shotOf(locator, …)` frames it.

## Keeping a pass

`qa publish <pass-name>` copies the run's captures and its report into
`docs/screenshots/<pass-name>/`, rewriting the report's image links from
`screenshots/…` to `./…` on the way. That rewrite is the whole reason it is a
command: copying the two across by hand leaves every image broken, and the
Markdown still renders, so nobody notices until weeks later. Write a `README.md`
beside them naming the two or three captures that settle a question faster than
a paragraph can.
