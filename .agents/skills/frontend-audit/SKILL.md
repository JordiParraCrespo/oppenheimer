---
name: frontend-audit
description: Audit the web console (apps/web) and the frontend packages (packages/frontend/*) against the frontend architecture, UI and render rules, including re-renders the React Compiler does not prevent. Use when asked to audit, review or health-check the frontend, check that the frontend architecture is being followed, look for unnecessary re-renders or render cost, or when the daily frontend-audit routine fires. Runs the mechanical checks, then reviews what they cannot see, and reports findings against a stable rule catalog.
---

# Frontend audit

The frontend rules are `.agents/rules/frontend-architecture.md`,
`.agents/rules/frontend-ui.md` and `.agents/rules/forms.md`. Most of them are
already checked by a script. This audit runs those scripts, then reviews what
no script can see: which clock updates a component, where its state lives, and
what re-renders when that clock ticks. Every finding cites a rule ID from the
catalog below, so a finding can be tracked from one run to the next and the
evals in `scripts/evals/frontend-audit/` can grade it.

## Arguments

- `full`: the whole of `apps/web/src` and `packages/frontend/*/src`.
- `diff --base <ref>`: only the frontend files changed since `<ref>`
  (`git diff --name-only <ref>...HEAD -- apps/web packages/frontend`), plus the
  files that render them or that they render when a finding depends on that.
- `routine`: what the daily routine runs. See **Routine mode** below.
- `--format json`: end with the JSON block only, no prose report. The evals use this.

With no argument, use `diff --base origin/main` when the branch has changes,
and `full` otherwise.

## Step 1: the mechanical checks

Run each command and record any failure as an `M-*` finding. Do not
re-diagnose a check's failure by hand: quote its output.

| ID | Command |
| --- | --- |
| `M-structure` | `pnpm check:structure` |
| `M-arch` | `pnpm arch` (needs the workspace built; turbo builds it) |
| `M-biome` | `pnpm exec biome lint --error-on-warnings apps/web packages/frontend` |
| `M-design` | `pnpm lint:design` (rules at `warn` are counts to watch, not failures; report a count that went up) |
| `M-compiler` | `pnpm check:compiler` (lists what the React Compiler leaves uncompiled; report a file that is new to the list, and judge each one under `R10`) |
| `M-render` | `pnpm --filter @oppenheimer/web test` and `pnpm --filter @oppenheimer/frontend-web test` (the `*-render.spec.tsx` budgets run in these) |
| `M-bundle` | `pnpm --filter @oppenheimer/web build && pnpm check:bundle` (`full` and `routine` only) |

If `node_modules` is missing, run `pnpm install --frozen-lockfile` first. A
check that cannot run is a finding too (`M-<id>` with `"severity": "info"` and
the reason), never a silent skip.

## Step 2: the review

A script already rejects wrong directories, forbidden imports, `useEffect`
outside `hooks/`, manual memo imports, nested component definitions, raw
colours and a route file over 120 lines. **Do not report those again**. Report
them only when the script missed a case, and say which script missed it.

For each component in scope, answer these questions before you look for rules
to cite:

1. **Which clocks update it?** A clock is anything that causes a re-render: a
   keystroke, a hover, an open/close, a query settling or refetching on focus,
   a websocket or terminal frame, a `setInterval`, a route change, a
   parent's render.
2. **Where does the state for each clock live?** Is that the lowest component
   that reads it?
3. **On each tick, what re-renders, and does any of it not need to?** Count it:
   "every keystroke re-renders 8 rows × 5 cells".
4. **Would the React Compiler prevent it?** Usually it would not, and the
   finding stands. See below.

### What the React Compiler does not fix

The compiler is on in `apps/web` (`react({ compiler: true })` in
`apps/web/vite.config.ts`). `@vitejs/plugin-react` runs the **oxc** port of it
(`oxc-transform-react`), not the Babel plugin, with `panicThreshold: 'none'`:
a function it cannot compile ships as written, and the build prints nothing.
The frontend packages are compiled too: Vite resolves the workspace links to
their real paths, which the plugin's `node_modules` exclusion does not match.
`react-compiler-healthcheck` runs the Babel compiler and misses oxc's
bailouts. `pnpm check:compiler` runs the same transform the build does and
lists them.

The compiler memoises the JSX and values *inside* a component, keyed on their
inputs, so a child whose props did not change is skipped. For state held too
high, that means the cost with the compiler on is the parent's own body plus
every child whose props change on the tick. That is smaller than the cost
without the compiler, but it is not nothing. It cannot:

- **Move state.** When a parent's `setState` fires on a keystroke or a tick,
  the parent re-renders and so does every child whose props changed on that
  tick. State held too high is still too high (`R4`, `R6`).
- **Stabilise what really changes.** A controlled `value` passed to a list, or
  a context value holding a fast clock, changes on every tick, so every reader
  re-renders (`R3`, `R7`).
- **Narrow a subscription.** `useWatch()` without `name`, `watch()`,
  `formState` read at the top of a form, or a query without `select` all
  re-render their component on every change to anything they cover (`R5`).
- **Skip a component it bailed out of.** Mutating props, state or a module
  variable during render, reading or writing `ref.current` during render,
  a conditional hook call, `'use no memo'`, and any `eslint-disable` of
  react-hooks rules make the compiler leave the whole component
  unmemoised, silently (`R10`).
  oxc also bails out on a default parameter that is an arrow function or an
  expression (`filter = (a, b) => …` in a props destructure) and on a `throw`
  inside `try`. `pnpm check:compiler` lists every case.
- **Keep an identity the data source throws away.** TanStack Query's
  structural sharing keeps an unchanged row's identity only for plain objects
  and arrays. The consumer's entities are classes (`SessionEntity`,
  `HostEntity`), so every refetch or poll hands every reader a new object, and
  every memo keyed on one misses. A getter that builds an object
  (`session.cwdCheckout`) does the same on every read (`R12`).
- **Make an impure render correct.** `Date.now()`, `new Date()` or
  `Math.random()` read during render gets cached on the inputs the compiler
  can see, so a relative time stops moving until something unrelated changes.
  That is a correctness bug the compiler introduces (`R13`).

The render budgets (`*-render.spec.tsx`) run with the compiler **off** on
purpose: they measure the component's shape, which is what these rules are
about. A profiler run with the compiler on will not show you any of this.

### The UI pass

The questions above find render cost. Rendering correctly on the design
system is a separate pass, and it gets skipped when the render questions
come up empty, so run it on every file in scope that returns JSX:

1. **Design system first (`U1`).** Read
   `packages/frontend/design-system/web/src/index.ts` in full, then the table
   under "Reach for the design system" in `.agents/rules/frontend-ui.md`. A
   `div` or `p` styled as a callout, an empty state, a status dot, a chip or a
   summary, where the design system ships one, is `U1`. That holds even when
   every class is a token, because `lint:design` only checks the classes, not
   what the markup builds. A `role="alert"` on a hand-built box is the tell.
2. **Every string the user can read goes through `t()` (`U3`).** That
   includes `aria-label`, `placeholder`, `title` and template literals.
3. **Colour outside the linter's reach (`U2`)**, and **forms (`U4`)**.

### Evidence bar

Report a finding only when you can state all four of: the clock, where its
state lives, what re-renders on each tick (with a count where you can get one),
and the fix. "This could re-render" is not a finding. If a code comment
already argues for the shape (the rules name several deliberate exceptions,
such as a `rowActions` dialog's open state living in the table), weigh the
argument. Report it only if the argument is wrong, and say why.

Prefer a missed finding to a wrong one. Each finding carries `confidence`
(`high` or `medium`); drop anything lower.

## Rule catalog

IDs are stable. Add new ones at the end and never renumber them, because the
tracking issue and the evals key on them.

| ID | Rule | Source |
| --- | --- | --- |
| `P1` | Placement: logic in the kit, UI in a product package, a kit concern that needs a product hook | frontend-architecture.md "Placement" |
| `P2` | A feature named after a screen rather than a module | "A feature is named after a module" |
| `P3` | A helper written a second time instead of promoted to the kit | "Imports flow one way", "Patterns agents get wrong" |
| `P4` | A route file doing more than compose: logic, queries or JSX beyond mounting a screen | "Imports flow one way" |
| `R1` | A query subscribed to above the component that renders its result, held for one child | "Fetch in the component that renders the result" |
| `R2` | A prop a component only forwards and never reads | same |
| `R3` | A live input value reaching a component that renders a list | "A live input value is never a prop…" |
| `R4` | State held above the lowest component that reads it | "State lives in the lowest component that reads it" |
| `R5` | A subscription wider than its reader: page-level `useWatch`/`watch`/`formState`, a query without `select` whose rows read one field | "Subscribe at the leaf" |
| `R6` | One component owning jobs on different clocks, so each clock redraws the others | "A component owns one job" |
| `R7` | A context whose value mixes change rates, or changes identity on every render | "Contexts split by change rate" |
| `R8` | A collection or `Map` rebuilt each render and passed to many children or a column factory | "Patterns agents get wrong" |
| `R9` | An effect that derives state, resets on a prop change, chains updates or fetches, or does not name the system it synchronises with | "An effect synchronises with something outside React" |
| `R10` | Code the React Compiler bails out of or never compiles, on a clock that matters | this skill, "What the React Compiler does not fix" |
| `R11` | A component with a fast clock (typing, a stream, a timer, a list of more than a few rows) and no `*-render.spec.tsx`, or a budget that misses one of its clocks | "A component whose cost is the point gets a render budget" |
| `R12` | Query data that loses its identity on every refetch or poll (class instances without a `structuralSharing` function, a getter or `select` that builds a new object), under a component that renders a list or sits on a poll | this skill, "What the React Compiler does not fix" |
| `R13` | A render that reads the clock or randomness, which the compiler then caches | same |
| `U1` | Hand-built markup where the design system ships the component | frontend-ui.md "Reach for the design system" |
| `U2` | A colour outside the token vocabulary that the linter did not catch (an inline `style`, a `dark:` override, a shadcn alias) | "One colour vocabulary" |
| `U3` | A user-visible string not going through `t()` | "Translate everything the user can read" |
| `U4` | A form not built as React Hook Form over a shared Zod schema, or a form that fetches | forms.md, frontend-architecture.md "A feature holds kind directories" |
| `U5` | A screen wired to the API with no spec in `e2e/tests/web/` | "Every product surface gets an end-to-end spec" |
| `M-*` | A mechanical check failed | Step 1 |

A rule that seems wrong or unenforceable as written is not a finding against
the code. List it under **Rules to revisit** in the report.

## Output

A short report, in this order:

1. **Checks**: one line per `M-*` check: pass, fail, or could not run.
2. **Findings**, highest cost first. For each: ID, `file:line`, one sentence
   on the clock and what it re-renders or breaks, and the fix.
3. **Rules to revisit**, if any.

Then a fenced `json` block. It is the machine-readable result, and it is always
the last thing in the output:

```json
{
  "mode": "full | diff | routine",
  "base": "<sha or null>",
  "head": "<sha>",
  "checks": { "M-structure": "pass | fail | skipped", "...": "..." },
  "findings": [
    {
      "rule": "R4",
      "file": "apps/web/src/features/sessions/sections/sessions-sidebar.tsx",
      "line": 88,
      "symbol": "SessionsSidebar",
      "severity": "high | medium | low | info",
      "confidence": "high | medium",
      "clock": "keystroke in the filter search",
      "compiler": "does-not-prevent | reduces | prevents",
      "summary": "One sentence.",
      "fix": "One sentence."
    }
  ]
}
```

`compiler` says what the React Compiler does about the cost: `does-not-prevent`
(the cost is the same with it on), `reduces` (it skips the children whose props
are stable, but the component itself still re-renders on the clock), or
`prevents` (a rule break the compiler happens to make free, which is still a
finding, at `low`, because the compiler bails out silently and the next edit
can bring the cost back).

A finding's fingerprint is `rule:file:symbol`. Keep `symbol` the component or
function name, not a line number, so the finding survives an edit above it.

Severity: `high` is a check failing, or a re-render of a list or of a whole
screen on a fast clock. `medium` is a real rule break with a bounded cost.
`low` is a rule break with no measurable cost today.

## Routine mode

The daily routine runs `/frontend-audit routine` in a fresh cloud session on
the default branch. In this mode:

1. Find the open GitHub issue labelled `frontend-audit`. Its body ends with
   `<!-- frontend-audit: last-sha=<sha> -->`. If there is no issue, create
   one titled "Frontend audit" with that label.
2. Scope: `full` on Mondays, when there is no `last-sha`, or when `last-sha`
   is no longer an ancestor of `HEAD`. On other days, `diff --base <last-sha>`.
   When nothing under `apps/web` or `packages/frontend` changed since
   `last-sha`, run only Step 1.
3. Rewrite the issue body: the check table, the open findings grouped by
   rule (a finding from an earlier run stays open until a run whose scope
   covers its file no longer finds it), and the new `last-sha` marker.
4. Add a comment only when something changed: new findings, resolved ones, or
   a check that changed state. List them by fingerprint. No comment on a quiet
   day.
5. Never push, never open a pull request, never edit code. The routine
   reports. A person decides what to fix.
