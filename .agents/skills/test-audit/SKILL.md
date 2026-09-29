---
name: test-audit
description: "Invoke whenever writing, changing, reviewing, or sweeping tests in this repo (Vitest specs in apps/api, apps/web, packages/*; Go tests in apps/runner and packages/go; the e2e suites). Authoring gate for new tests plus audit workflow for low-value, implementation-coupled, or duplicative tests and the test-only production seams they demand. Campaign mode prunes one subsystem's whole test surface."
---

# Test Audit

Adapted from OpenClaw's `test-audit` skill (MIT, `openclaw/openclaw` at
`ece1294b`) to this repo's layout and tooling.

Three modes, one value bar. Authoring mode gates every new or changed test at
write time. Audit mode runs focused sweeps of tests that re-assert source,
duplicate stronger proof, couple behavior to implementation, or keep test-only
production seams alive. Continue broad audits as separate coherent follow-up
PRs; optimize for confidence, not deletion count. Campaign mode prunes one
whole subsystem's test surface (every test file an API module, the runner, a
frontend package or another area owns); before starting one, read
[CAMPAIGN.md](CAMPAIGN.md).

## Authoring gate

Before adding any test, answer four questions; a missing answer means do not
add it yet:

1. What observable behavior, invariant, or independent contract does it protect?
2. What credible regression makes it fail?
3. Why does existing coverage not already catch that failure? Each contract has
   one primary test owner at the strongest boundary; another layer needs its
   own distinct risk, such as a transport or lifecycle failure the owner cannot
   reach. Prefer extending a table-driven case (`it.each`, a Go table) or a
   shared fixture over a near-duplicate test; consolidate duplicated setup in
   the same change.
4. Does it need a production seam (export, flag, wrapper, injection hook) that no
   production caller needs? If yes, move the test to the real boundary instead.

Then check the test against every [junk pattern](#junk-patterns); a match fails
the gate unless the [retention bar](#retention-bar) names the contract it
independently guards. A test that would break under behavior-preserving
refactoring is asserting implementation, not behavior; rewrite it at the
owning boundary before landing it.

Bug regression tests must fail on the pre-fix code for the intended reason and
pass after the owner-boundary repair. A regression test that never demonstrably
failed proves the mock, not the fix. One regression at the owner boundary
covers the bug; do not replay the same scenario at every layer it crosses.

### Where the owner boundary usually is here

- **API (`apps/api`)**: a command or query handler with in-memory or fake
  ports is the owner of a use case; the controller spec owns HTTP shape
  (status, problem document, guards, scopes); the `*.integration.spec.ts`
  suite owns persistence and SQL; the domain entity or value object owns its
  invariants. A controller spec that replays the handler's branches through a
  mocked `CommandBus` is a duplicate layer.
- **Runner (`apps/runner`)**: the service in `internal/<module>/app` with fake
  ports owns behavior; adapters own their I/O against a temp dir, a fake
  exec or `httptest`. `internal/arch/arch_test.go` is an architecture
  contract, keep it.
- **Frontend**: a service or repository in `packages/frontend/*` owns its
  logic; a hook or component test owns what the user sees and does. A test
  that asserts which query key a hook passed is call-shape.
- **Shared schemas (`packages/shared`)**: the Zod schema is a wire contract
  between API and clients; test the inputs it accepts and rejects, not that the
  schema object has certain keys.

## Junk patterns

The shared checklist for both modes: the authoring gate rejects a new test that
matches one, and audits hunt for existing tests that do.

- assertion-free coverage probes (`expect(x).toBeDefined()` on a freshly
  constructed class, "should be defined" Nest boilerplate);
- self-comparisons and identity copiers;
- copied fixtures, inventories, manifests, or export lists;
- exact source, import, or string greps;
- private predicate or call-shape tests duplicated at real boundaries
  (`toHaveBeenCalledWith` on a collaborator when the outcome is observable);
- duplicate invocations of the same contract;
- per-module replays of shared helpers (`packages/backend/*`, `@oppenheimer/backend-ddd`);
- tests whose only purpose is preserving test-only exports, globals, or wrappers;
- dead production code whose only callers are tests;
- expected values produced by the helper or renderer under test;
- mocks that implement the asserted behavior, or one identical mock standing in
  for different APIs;
- fixtures that supply the receipt, admission, or callback ordering the owner
  should produce, or persistence asserted against a store the path never writes;
- capability tests that restate declared flags, scopes or decorators instead of
  exercising the guard or delivery the declaration promises;
- negative controls that pass for an unrelated reason, such as a denial from a
  different guard or a rejection the production path never reaches;
- names or fixtures that promise more than the input exercises, such as a
  "revokes the token" test asserting the token was _not_ deleted.

## Value bar

Tests justify their maintenance cost by protecting behavior, a credible
regression, or an independently meaningful contract. In an audit, an existing
test that must change for behavior-preserving source reorganization is suspect,
not automatically deletable; the authoring gate still rejects new ones.

Before judging a candidate, read the complete test and production owner, its
entry point, callers, callees, sibling implementations, overlapping tests, the
integration and e2e suites that reach the same path, and relevant history. Read
the root and scoped `AGENTS.md` files and the `.agents/rules/` file that
governs the code first. When the test claims dependency-backed behavior
(TypeORM, Better Auth, BullMQ, tmux, git), inspect the dependency source or
types directly.

## Discovery

Keep discovery read-only and report evidence before editing. For broad scope,
run parallel discovery lanes when available:

- API modules (`apps/api/src/<module>`);
- backend and shared packages (`packages/backend/*`, `packages/shared`, `packages/auth`);
- runner and Go packages (`apps/runner`, `packages/go/*`);
- frontend (`apps/web`, `packages/frontend/*`) and `e2e`;
- scripts and tooling (`scripts/`);
- a cross-cutting pattern sweep.

Outside campaign mode, prefer a few high-confidence candidates over a large
speculative inventory. Hunt for the [junk patterns](#junk-patterns).

## Retention bar

Keep a test when it independently enforces a public API, the runner↔API
protocol, a Zod wire schema, config, migration, storage, security (authz,
scopes, credential handling, signature verification), platform (launchd,
systemd, macOS vs Linux), default, error catalog (RFC 7807 codes), package,
release, or architecture contract. Also keep:

- call ordering when order is observable behavior;
- regressions with a credible failure mode;
- source inspection when it is the cheapest independent guard: it fails when
  the contract changes (the user-facing key, byte, or path) and survives an
  identifier-only refactor;
- a retained test that fails on the baseline: treat it as a possible product
  bug, reproduce it, and repair the owner rather than deleting it.

Static or slow is not a deletion reason. A test that resembles implementation
may still be the independent contract; prove otherwise before removing it.

## Candidate evidence

Record every field below before editing. A missing field means the candidate is
not ready for deletion:

- exact test name and location;
- what failure it can actually detect;
- non-test callers of the covered production or support seam;
- stronger remaining owner-boundary proof, or why no proof is needed;
- relevant history and the reason the test or seam exists;
- production or test-support deletion unlocked;
- risk and the focused validation command.

## Edit shape

Choose one coherent owner-boundary batch. Delete obsolete test-only exports,
globals, wrappers, and dead production paths instead of preserving aliases.
Move retained regressions to their canonical owners. Consolidate repeated
package or dependency assertions into one generic contract.

Prefer net-negative production LOC. Do not add replacement tests that restate
the same implementation, and do not convert uncertain candidates into cleanup
to increase deletion counts.

## Validation

Never edit source or tests while Vitest is running in watch mode in the
checkout.

1. Run the smallest owner and sibling tests:
   `pnpm --filter <package> exec vitest run <path-or-filter>` for Vitest,
   `go test -count=1 ./internal/<module>/...` in `apps/runner` or the
   `packages/go/<name>` module for Go.
2. For removed source greps or plan assertions, run the script or check that
   owns the real contract (`pnpm arch`, `pnpm check:structure`,
   `pnpm check:api-structure`, `go test ./internal/arch/...`).
3. Run `pnpm check` (Biome) or `gofmt -l`, then `git diff --check`.
4. Run the package's `typecheck`: a deleted export can leave a dangling import
   in a file Vitest never loads.
5. Commit and run `pnpm ci:local`; it picks what the diff affects
   (`scripts/ci/affected.mjs`). Integration and e2e rows need Docker; when
   the environment has none, say so in the report rather than claiming them.
6. Inspect `git diff --numstat`; report production/tooling separately from
   tests and test support.
7. After final audit edits, run `/code-review` on the diff.

## Landing and continuation

Commit, push, open a PR, or land only when authorized. Follow the `steward`
skill: the PR carries the `.ci-local/report.md` for its head. Land one
coherent PR at a time; after landing, refresh from current `main` and rerun
read-only discovery for the next high-confidence batch.

## Handoff

Report:

- root cause and removed low-value categories;
- production owner simplifications;
- retained false positives and why they remain valuable;
- focused and full proof actually run;
- production versus test LOC;
- PR and merge state;
- named follow-ups.
