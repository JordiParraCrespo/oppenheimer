---
name: correct
description: "Find the mistakes agents keep repeating in this repo and make each one impossible: architecture first, then types, then a check whose error names the fix, then a test, and an agent rule last. Proves each new check fails on a real past mistake and keeps `.agents/enforcement.md`, the table pairing every rule with what enforces it, current. Use for /correct, or when the operator corrects an agent for a mistake the repo already has a rule about."
disable-model-invocation: true
argument-hint: "[a correction, a mistake class, or nothing to mine history]"
---

# Correct

Adapted from poteto's `correct` skill in pstack (MIT, `cursor/plugins` at
`1e5c90a`).

The operator keeps correcting agents in this repo for the same mistakes.
Change the repo so the next agent cannot make them.

Assume every contributor is an agent that sees only the files it opened,
copies the nearest example, and takes the shortest path that compiles. Design
the repo so a change that looks right from one file is right for the whole
repo. A rule in `.agents/rules/` reaches an agent only when its `paths` glob
matches what it opened, and nothing fails when the agent skips it.

## Find the mistake classes

With an argument, start from that correction. Without one, mine:

- `git log origin/main` for `revert` commits and for `fix` commits that
  undo something an agent wrote earlier;
- review comments and `Claude Code Review` findings on recent pull requests
  (the GitHub MCP tools), and the open `main-red` and `frontend-audit`
  issues;
- the comments in the code that explain a workaround, and the rules in
  `.agents/rules/` and every `AGENTS.md` that say *never* or *always*;
- `.agents/enforcement.md` itself: every row whose enforcer is "rule text
  only" is a candidate.

Group what you find into classes. A class counts once it has happened twice.
One incident is a bug fix, not a class.

## Fix each class at the highest level that works

1. **Eliminate it with architecture.** Give each piece of state one owner and
   each task one supported way. Hide internals so the wrong import fails: a
   dependency-cruiser rule (`apps/api/.dependency-cruiser.cjs`, the frontend
   tier's), `apps/runner/internal/arch/arch_test.go`, a `noRestrictedImports`
   in `biome.json`. Replace a hand-synced list with one source of truth or a
   coverage spec that holds the two sides together, the way
   `apps/api/src/__tests__/environment-coverage.spec.ts` holds `.env.example`.
   Delete old ways and dead code an agent would copy.
2. **Make the bad state unwritable with types**: a Zod schema in
   `packages/shared`, a union instead of a string, a branded id. If bad code
   still compiles, add a check whose error names the file, type or function
   to use instead. The places a check goes, from narrowest to widest:
   - a Biome GritQL plugin in `biome-plugins/`, with a fixture beside it
     (`biome-plugins/fixtures/README.md`);
   - a structure check (`scripts/check-api-structure.mjs`,
     `scripts/check-frontend-structure.mjs`) or a new `scripts/check-*.mjs`
     with a `*.test.mjs` built on fixtures;
   - a coverage spec under `apps/api/src/__tests__/` or a Go test under
     `apps/runner/internal/arch/`.

   If the pattern is already common, fail only when a change adds more: the
   `LEDGER` in `scripts/check-api-structure.mjs` is the model, a list of
   known breaches that fails when an entry goes stale.
3. **Test the behaviour.** Fix or delete any test that would still pass if
   every function it calls returned nothing; the bar is `test-audit`.
4. **Write an agent rule last, only for judgment calls**, in the
   `.agents/rules/` file whose `paths` cover the code, or the nearest
   `AGENTS.md`.

## Fix and prove

Fix the most frequent classes now, one commit each.

Prove each new check fails on a real past mistake: check out the commit that
made it (`git worktree add <scratch> <sha>`), run the check there, and paste
the failure. A check that has never failed on real code proves nothing.

Run the same command locally and in CI. CI is local here, so a new check is a
step in `scripts/ci/local.mjs` and nowhere else, behind the root
`package.json` script a contributor would type.

An exception goes on the offending line with its reason (`biome-ignore
lint/...: <why>`, a ledger entry with a comment), and with an expiry where the
tool can hold one, as `expiresAt` does for flags. Say in the pull request who
approved it.

## Keep the rule table

`.agents/enforcement.md` pairs every rule with what enforces it. Each
correction updates it:

- a new rule gets a row naming its enforcer and the command that runs it;
- if the rule was already there and its row says "rule text only", the
  correction is a repeat: fix it at the highest level in the same change and
  update the row;
- a row whose enforcer is claimed but runs nowhere is the worst kind, because
  it reads as safe; fix the claim or the enforcer;
- drop a row's prose once its mistake cannot happen.

**Reply:** each class with its evidence (commits, comments, counts), the level
you picked and why a higher level did not work, the past mistake each new
check fails on, and the rows you changed in `.agents/enforcement.md`.
