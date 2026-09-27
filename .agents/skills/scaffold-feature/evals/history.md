# Eval history

Each round runs scenarios from `evals.json` in fresh worktrees and has a
separate agent grade the diffs blind (labels shuffled), expectation by
expectation, plus the extras a senior reviewer would flag.

## Before the port: the Flama starter's rounds

The process in `SKILL.md` was written and hardened in the Flama starter this
repo was forked from, against its own scenarios (a members pane, a new
workspaces module, a mobile devices screen, a token rename with no endpoint,
a review of a planted devices page). There, the rewrite beat the old
generator's manual (a 77-line SKILL.md) in every scenario: 42 of 43
expectations against 36 in round 2. The graders separated the attempts on
what the expectations did not name, and those became the rules now in the
skill: read the controller's policies and business rules and mirror them,
render every read's failed state *instead of* the list, translate data labels
without losing what keys on the raw value, build only what was asked, lead a
review with its findings, and say which checks did not run.

## The port (2026-09)

Ported to the console: web only, the `@oppenheimer/*` packages, the consumer
modules (`sessions`, `hosts`, `projects`, `installations`, `organizations`,
`profile`, `api-tokens`), Settings as child routes with a `SettingsSidebar`,
personal workspaces (no roster or invitation UI), `shareEntities` and
`use…Snapshot()` on entity queries, `useNow` for clocks, the semantic colour
tokens, and the `/tanstack-routing` and `/frontend-audit` skills where the
process meets them. `verify-feature.mjs` runs the package scripts under the
hoisted install and adds the design-system lint and the compiler bailouts as
reports.

The scenarios were rewritten for this product: API tokens in Settings (hooks
exist, no screen), a host's activity timeline (the endpoint exists, the
module lacks the call), signed-in browsers on Settings → Profile (the
`profile` / `sessions` naming trap), pausing a routine (no API at all), and
the planted devices page, which now also has to move into Settings.

No round has been run against this repository yet. The first one should
compare this skill with the lone SKILL.md it replaced.
