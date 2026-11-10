# More unsupervised work

Research, 2026-11-09. It decides nothing. The owner asked how this
repository can do more work without him watching: routines, test suites,
idea creation and UX enhancements, with a read of pstack, Peter
Steinberger's setup and others like them.

## 1. The answer in short

Agent throughput is not what limits this repository. `main` took 244 merge
commits in the last seven days (measured, `git log origin/main --merges
--since='7 days ago'`). What limits it is the three things only the owner
does: accept a `propose` pull request, decide what is worth building, and
judge how the console looks. More unsupervised work therefore means two
things, in this order:

1. **Loops that end in a `ship`.** Work whose result a machine can verify
   needs no acceptance. The repository has five such loops, and all five
   audit code structure. None drives the product the way a user does, and
   that is where the next ones should go (§5).
2. **One place where everything that needs him waits.** Each new loop
   that ends in a `propose` adds to his queue. A loop is only worth adding
   with a cap on what it may leave open, and with its questions gathered
   in one list he can answer in one sitting (§6).

The three stacks read below agree on the shape of a loop that can run
alone, and the routines here already have most of that shape. What they
add is four kinds of loop this repository lacks: a QA explorer, a UX
review, an idea list and a retro that edits the harness.

## 2. What was read

| Source | How it was read | Standing |
|--------|-----------------|----------|
| pstack, Lauren Tan's ("poteto") skill stack for Cursor, upstream `cursor/plugins/pstack` | The README and five skill files from the `backnotprop/pstack` mirror, which says it keeps upstream unchanged below its header | Read directly |
| Peter Steinberger's `steipete/agent-scripts`, `AGENTS.MD` | The file itself | Read directly |
| Steinberger on loops (a post of 2026-06-07) and his interviews | Search summaries only; `x.com` and the newsletter that interviewed him are outside this session's network | Second hand |
| gstack, Garry Tan's skills, `garrytan/gstack` | The README and `ETHOS.md` | Read directly |
| Claude Code's scheduled tasks (formerly routines) | `code.claude.com/docs/en/routines.md` | Read directly |
| This repository | `.agents/routines/`, the skills, the hooks, `scripts/ci/plan.mjs`, `e2e/README.md` | Read directly |

"pstack" in the owner's question is ambiguous: besides Tan's there is
`no-session/pstack`, a fork of gstack for solo founders (154 stars against
about 4,000 for each mirror of Tan's). This note reads Tan's.

## 3. What each one does

### 3.1 pstack

Its claim is the opposite of volume: "the goal is not to maximize loc",
and "when you can go deep on one agent and trust it to write good,
verifiable code, you can truly parallelize with confidence". One entry
skill, `poteto-mode`, picks one of twenty-three playbooks and copies its
steps into a todo list, which is what `/cook` does here with three lanes.
Four of its pieces bear on unattended work:

- **Autonomous run.** "You own the exit condition. Define done, then drive
  to it without stopping." The exit condition is "a checkable predicate"
  stated before the first iteration. Each iteration makes the smallest
  change, verifies it, commits it if it advanced and discards it if not.
  The agent fixes what it trips over (a flaky verifier, a broken skill) in
  a pull request of its own, and surfaces "only irreversible actions,
  genuine product or preference calls no experiment can settle, or a real
  dead end". It may "never relax the predicate to declare victory".
- **Hillclimb.** A loop on one number: fix the metric and a stop rule,
  build the measurement and "prove its sensitivity, then freeze it", then
  "one change, one measurement, keep or revert", with a row per attempt
  in a `decision.tsv` kept out of the tree.
- **A verification skill per project** (`create-verification-skill`): a
  generated skill that launches the app, drives it "the way a user does"
  and captures evidence, with a feature map, one file per user-facing
  feature saying how to reach it and what end state proves it works.
- **Reflect.** Three reviewers read the session's transcript and route
  each learning to an edit of an existing skill. A learning that "a lint
  rule, script, metadata flag, or runtime check would enforce more
  reliably" goes to a backlog instead, and nothing is applied before the
  user approves, because "skill changes affect every future agent".

This repository already carries three pstack skills, adapted: `bro`,
`ketchup` and `correct` (the last is pstack's "encode lessons in
structure" as a skill).

### 3.2 Steinberger

His shared `AGENTS.MD` is a list of hard rules, and what stands out in it
is how many are standing approvals written down so that no agent asks:
"Routine `$autoreview` is pre-approved … never ask Peter for autoreview
approval"; test-box leases are "pre-approved; never ask for
confirmation"; "`fix ci` = consent to pull, commit, push". Beside them
sit the refusals, each with its date, such as team deployments that
"require Peter's explicit per-deployment approval (September 13, 2026)".
The rest matches what this repository does: "Before every commit/land:
`$autoreview` until no accepted/actionable finding", before and after
pictures on a UI pull request, a regression test with a bug fix, proof
"narrowly and locally first", and a narrative recap after every merge.

His line on loops is second hand here: on 2026-06-07 he wrote that people
should stop prompting coding agents and design the loops that prompt
them. The commentary found agrees on what that means: a loop is a
program that prompts the agent, reads the result and decides whether it
is done, and it is only as good as the check that decides. That is
pstack's predicate.

### 3.3 gstack

About fifty skills named after roles, chained through files: a design
document from `/office-hours` feeds the plan reviews, whose test plan
feeds `/qa`. The pieces that answer the owner's four asks:

- **`/qa` and `/qa-only`.** `/qa` "opens a real browser, reproduces bugs
  and fixes them", writing the failing regression first. `/qa-only`
  explores and reports "with replayable evidence" and changes nothing.
- **`/design-review`.** Scores the live interface on each design
  dimension, then fixes what it finds in "atomic commits, before/after
  screenshots".
- **`/office-hours`.** Six forcing questions that push back on the
  framing before any code. It is interactive by design.
- **`/retro`.** A weekly look at what shipped and how the tests fared.
- **`/autoplan`.** Runs four reviews in a row and "surfaces only taste
  decisions for approval".

Its ethos has a rule the unattended case needs, "User Sovereignty":
"AI models recommend. Users decide", and two models agreeing "is signal,
not proof".

### 3.4 Claude Code's scheduled tasks

The platform under this repository's routines, as its documentation
stands today:

- Three triggers, which one task may combine: a schedule, an HTTP `POST`
  to the task's own endpoint, and GitHub events (pull request and release
  events, with filters on branch and label).
- A schedule may not run more often than once an hour. An account gets
  100 scheduled runs an hour, and a run exactly on the hour may start
  minutes late.
- A run is a full cloud session in auto mode, with the repository's
  skills and hooks, and it draws on the same usage as the owner's own
  sessions.
- A GitHub event starts a new session each time; sessions are not reused.

## 4. What this repository already has

Read against those three, the harness here is not behind. It has:

- three lanes with a stated merge rule each, and `/cook` to pick one;
- an independent verifier before a `ship` merges, and `autoreview` before
  any pull request opens;
- hooks that refuse the dangerous git commands and a visual change
  without screenshots;
- five routines (`.agents/routines/README.md`), each with one issue as its
  state, a cap on pull requests per run, a "Needs a decision" section and
  silence when nothing changed, and evals for the two audits;
- `recall`, `ketchup` and `recap`, which are the owner's side of the loop.

What it lacks, by the owner's four asks:

| Ask | Here today | Missing |
|-----|------------|---------|
| Routines | Hexagon audit, frontend audit, backend review, Grok Bot watch, main red: four inspect code or a competitor, one repairs `main` | A loop that uses the product, one that looks at it, one that proposes what to build, one that improves the harness from its own mistakes |
| Test suites | `pnpm ci:local` runs one end-to-end row, `e2e:api` (`scripts/ci/plan.mjs`); the `web` project "passes but is not a CI row yet" (`e2e/README.md`), and the fleet suites run on demand. `test-audit-campaign` exists as a skill with no schedule | Browser journeys on a schedule, a record of flaky tests, exploration beyond the written specs |
| Idea creation | `product/next-steps/` is the owner's list, written by hand; Grok Bot watch proposes at most two changes when that one product ships | A ranked list fed by more than one competitor and by the product's own evidence |
| UX enhancements | Screenshots are taken per pull request, of the routes that pull request touched | Anyone looking at the whole console, on a schedule, as a designer would |

## 5. Four loops to add

Each is a routine prompt in `.agents/routines/`, written like the five
that exist. Listed by value for cost.

**1. QA explorer, nightly.** Brings the stack up with `--web`, walks the
console as a new account through a feature map (pstack's idea: one file
per feature with how to reach it and what proves it works), and looks
for what the specs do not: console errors, failed requests, dead ends,
states with no way out. A defect it can reproduce gets a failing
Playwright spec first, then the fix, in a `ship` pull request, because a
reproduced defect is what `ship` is for. Everything else goes to one `qa`
issue with the evidence. This is the only one of the four whose output
can merge without the owner, which is why it is first. It also turns
exploration into written specs, so the suite grows where bugs were.

**2. UX review, weekly.** Photographs every route light, dark and at phone
width with the camera that exists (`pnpm screens`), and reviews the
pictures against `frontend-ui.md` and the design system, as gstack's
`/design-review` does. It keeps one `ux-review` issue, and opens one
`propose` pull request a week with the fixes it is sure of and a board of
before and after pictures, so accepting it is one look. One a week, not
one per finding: each is a visual change, and each costs the owner a
judgment.

**3. Ideas, weekly.** Reads `product/`, the week's merged pull requests,
the open audit issues and the competitors' public changes (the Grok Bot
watch is the template; Codex, OpenClaw and herdr already have notes
here). It keeps one `ideas` issue: at most ten, ranked, each with what it
is, the evidence, the size and the note it would change. It builds
nothing. The owner ticks an idea, and the next run starts a `/propose`
for each ticked one. gstack makes this step interactive on purpose; a
tick box is the unattended form of the same rule.

**4. Retro, weekly.** Reads the week's review comments and the corrections
the owner made in sessions, and runs `/correct` on what repeats: a check
first, a rule last, as pstack's reflect routes it. Its pull requests are
`propose`, since they change how every later agent behaves.

Two more need no routine. A **hillclimb** is a session with `/loop` and a
frozen measurement, for one number the owner names: `pnpm ci:local` wall
time, the web bundle, session boot time (`session-boot-time.md` has the
harness). And **`test-audit-campaign`** can run monthly on the subsystem
with the most new tests, as the backend review picks its areas.

## 6. What keeps the queue from growing

Human supervision of automation has a measured ceiling
(`focus-and-attention.md` §1.6), and at 244 merges a week the owner is
near it. Three rules, which the existing routines already half follow:

- **A cap on open work per loop.** A routine that has a `propose` pull
  request open does not open another; it adds to the one it has.
- **One list of decisions.** Every routine's "Needs a decision" items go
  to one `decisions` issue, each with the options and the routine's own
  pick, so the owner answers ten in one sitting. `/ketchup all` reads it.
- **Standing approvals, written down.** Steinberger's file shows the
  cheap half of autonomy: each time the owner answers the same question
  twice, the answer becomes a line in `AGENTS.md` or the lane's skill,
  with its date.

## 7. What not to take

- **Installing either stack whole.** pstack's twenty-three playbooks and
  gstack's fifty skills overlap `/cook`, `steward` and the lanes, and the
  backend review already measures what the harness costs each turn. Take
  the four patterns in §5, written in this repository's own terms.
- **Dropping review.** One interview summary has Steinberger saying code
  review is dead for his workflow. It was not read first hand, and his
  own file requires a review before every commit. The verifier before a
  `ship` stays.
- **Merging visual changes unseen.** No source read does this. gstack and
  Steinberger both require pictures, and pictures are for a person.

## 8. Next

Each of §5's loops is a `/propose`, since each adds a routine and its
prompt. The suggested order is the QA explorer, the decisions issue with
the cap, the UX review, ideas, then the retro. A routine is created by
the owner in claude.ai with this repository attached
(`.agents/routines/README.md`); the prompt file is what a pull request
can carry.

## 9. Sources

- pstack: <https://github.com/cursor/plugins/tree/main/pstack>, read
  through <https://github.com/backnotprop/pstack> (`README.md`,
  `skills/poteto-mode/playbooks/autonomous-run.md` and `hillclimb.md`,
  `skills/reflect`, `skills/automate-me`,
  `skills/create-verification-skill`)
- Steinberger: <https://github.com/steipete/agent-scripts> (`AGENTS.MD`);
  the loops post, <https://x.com/steipete/status/2063697162748260627>,
  not reachable from this session
- gstack: <https://github.com/garrytan/gstack> (`README.md`, `ETHOS.md`)
- Scheduled tasks: <https://code.claude.com/docs/en/routines.md>
- Not reachable, known only from search summaries: the a16z essay on
  making a loop converge, and the Pragmatic Engineer interview with
  Steinberger
