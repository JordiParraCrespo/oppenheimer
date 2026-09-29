---
name: test-audit
description: "Audit tests in this repo for low value: specs that re-assert source, duplicate stronger proof, couple to implementation, or keep test-only production seams alive. Use when asked to audit, sweep, prune or review a set of tests (Vitest in apps/* and packages/*, Go tests in apps/runner and packages/go, the e2e suites). A whole-subsystem pruning is `test-audit-campaign`."
---

# Test Audit

Adapted from OpenClaw's `test-audit` skill (MIT, `openclaw/openclaw` at
`ece1294b`).

A targeted sweep: find the tests that do not earn their maintenance cost,
prove each one with evidence, and remove or repair a coherent batch. Optimize
for confidence, not deletion count; continue a broad audit as separate
follow-up pull requests. Pruning every test a subsystem owns is
[`test-audit-campaign`](../test-audit-campaign/SKILL.md), which uses this
file's bar.

## Value bar

Tests justify their maintenance cost by protecting behavior, a credible
regression, or an independently meaningful contract. Each contract has one
primary test owner at the strongest boundary; another layer needs its own
distinct risk, such as a transport or lifecycle failure the owner cannot
reach. An existing test that must change for behavior-preserving
reorganization is suspect, not automatically deletable.

Before judging a candidate, read the complete test and production owner, its
entry point, callers, callees, sibling implementations, overlapping tests
(including the integration and e2e suites that reach the same path) and
relevant history. When the test claims dependency-backed behavior, read the
dependency's source or types.

## Owner boundaries

Where the owner sits is already written down per area; read it there rather
than guessing:

- API: `apps/api/AGENTS.md` and `apps/api/ARCHITECTURE.md` (domain,
  command/query handlers, controllers, adapters, `*.integration.spec.ts`).
- Runner and Go packages: `apps/runner/AGENTS.md`,
  `apps/runner/ARCHITECTURE.md`, `.agents/rules/go.md`.
- Frontend: the placement grid in `.agents/rules/frontend-architecture.md`
  and `apps/web/AGENTS.md`.
- Wire contracts: `packages/shared` schemas and the protocol in
  `product/versions/mvp/01-protocol.md`.

## Junk patterns

- assertion-free coverage probes ("should be defined");
- self-comparisons and identity copiers;
- copied fixtures, inventories, manifests, or export lists;
- exact source, import, or string greps;
- private predicate or call-shape tests duplicated at real boundaries;
- duplicate invocations of the same contract;
- per-module replays of a shared helper's own contract;
- tests whose only purpose is preserving test-only exports, globals, or wrappers;
- dead production code whose only callers are tests;
- expected values produced by the helper or renderer under test;
- mocks that implement the asserted behavior, or one identical mock standing in
  for different APIs;
- fixtures that supply the ordering or result the owner should produce, or
  persistence asserted against a store the path never writes;
- declaration tests that restate flags, scopes or decorators instead of
  exercising the guard the declaration promises;
- negative controls that pass for an unrelated reason, such as a denial from a
  different guard or a rejection the production path never reaches;
- names or fixtures that promise more than the input exercises.

## Retention bar

Keep a test when it independently enforces a public API, wire schema or
protocol, config, migration, storage, security (authz, scopes, credentials,
signatures), platform, default, error catalog, package, release, or
architecture contract. Also keep:

- call ordering when order is observable behavior;
- regressions with a credible failure mode;
- source inspection when it is the cheapest independent guard: it fails when
  the contract changes and survives an identifier-only refactor;
- a test that fails on the baseline: treat it as a possible product bug and
  repair the owner rather than deleting it.

Static or slow is not a deletion reason.

## Candidate evidence

Record every field before editing; a missing field means the candidate is not
ready:

- exact test name and location;
- what failure it can actually detect;
- non-test callers of the covered production or support seam;
- stronger remaining owner-boundary proof, or why no proof is needed;
- relevant history and why the test or seam exists;
- production or test-support deletion unlocked;
- risk and the focused validation command.

## Edit shape

One coherent owner-boundary batch per pull request. Delete obsolete test-only
exports, wrappers and dead production paths instead of preserving aliases.
Move retained regressions to their owners; prefer extending a table case over
a near-duplicate. Do not add replacement tests that restate the same
implementation, and do not turn uncertain candidates into deletions.

## Validation

1. Run the owner and sibling tests (`pnpm --filter <pkg> exec vitest run
   <path>`, or `go test -count=1 ./<pkg>/...`).
2. For a removed source grep, run the check that owns the real contract
   (`pnpm arch`, `pnpm check:structure`, the arch test).
3. Typecheck the package: a deleted export can leave a dangling import in a
   file the tests never load.
4. Report `git diff --numstat` with production and tests counted separately.

Landing follows the `steward` skill.

## Handoff

Report the removed categories, production simplifications, retained false
positives and why they stay, the proof actually run (and what could not run
here), production versus test LOC, and named follow-ups.
