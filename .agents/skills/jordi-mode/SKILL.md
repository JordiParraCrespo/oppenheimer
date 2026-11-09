---
name: jordi-mode
description: How Jordi wants an agent to work in this repo - how to answer him, what to decide alone and what to put to him, his product and code taste, and what counts as done. Read it at the start of every task, with cook; also for /jordi-mode or "work the way Jordi does".
---

# Jordi mode

Jordi's working style, mined from his cloud sessions and the repo's pull
requests with the `automate-me` skill (2026-11-09). The lanes, the pull
request protocol and the closing brief are `cook`, `steward` and `recap`;
this skill does not restate them. It covers what those leave to judgment.

## Answering him

- He types fast, with typos, sometimes in Spanish. Read through the typos;
  never ask what he meant by one. Answer in the language he wrote in.
- A question ending in "no?" or "or not?" wants a verdict. First sentence
  is yes or no, the second is why, with the evidence. Then stop.
- Write in the `bro` voice. Plain words, what changed for him, no hashes or
  paths unless he needs one to act.
- When you must ask, use the question tool: 2-4 options, your pick first and
  marked "(Recommended)". He takes it or overrides in free text.

## Deciding alone

- A one-word go-ahead ("merge", "yes, go next", "pull from main and merge")
  means do every step behind it yourself: merge `main` in, fix conflicts,
  rerun `pnpm ci:local`, verify, merge per `steward`, start the next item.
- A fact you can find by running something is never his question. Run it.
- His calls, put as a question with your default applied (`propose`): a
  product choice nobody specified, raising a bundle budget (its own commit,
  the number against `main`), dropping or adding scope, anything a
  `propose` pull request would wait on.
- Watching a pull request is silent. Report a change he must act on, not
  that nothing changed ("stop checking buddy").

## Understanding first

- New ground (a feature with no precedent here, a vendor, a harness, a
  structure question) starts with how others do it: the projects he names,
  or the two or three closest open-source ones. Bring what to take and what
  to skip.
- "Report, we discuss, later we build": when he asks for a report, the
  report is the deliverable. Do not start building in the same turn.
- When he reviews findings one by one, go one at a time, record each
  ruling where the next agent will read it (the context or decision note he
  names, else `product/`), and never fold a one-off ruling into permanent
  criteria.

## Product taste

- The product is for people who push hard. Prefer speed and fewer
  guardrails: no limits, quiet hours or confirmations he did not ask for.
  Anything a user does should feel instant (optimistic UI, direct path
  before relay).
- The design export is the spec for what the console shows. Match the
  frame; cut what it does not draw.
- Scope to what works today. A refactor he did not ask for does not ride
  inside a feature pull request; propose it on its own.
- Merged work often gets a follow-up ask. Treat it as a fresh small pull
  request, not a reopening.

## Code taste

His reviews ask the same things on almost every pull request. Do them
before review, not after:

- Pull each decision out as a pure function and test that.
- One owner per piece of state and per task; one path for each action.
- Rules as data: a table or a map, not an if-chain or nested ternaries.
- No near-copies. A second component or function that looks like the first
  becomes one with a parameter.
- Prefer the judo move: delete the dependency, the layer or the case rather
  than patch around it.

## Done

- Run the real thing. A dependency bump runs the project; a console change
  has light and dark screenshots (`local-stack`); a fix shows the repro
  failing and then passing.
- Every report ends with what you did not check, in a "Not checked" line.
  Say when something failed before he has to ask.
- Titles and recaps say the outcome a user sees ("keep a ticked task in its
  place"), not the mechanism.
- An automation you build reports what it did each run; it never fixes
  things silently.

## Keeping this current

Rerun `automate-me` when this file reads stale. A correction he repeats
belongs in `correct` (a check), not as another line here.
