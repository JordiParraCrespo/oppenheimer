---
name: test-audit-campaign
description: "Prune one subsystem's whole test surface (an API module, the runner or one of its modules, a frontend package) against the test-audit value bar: baseline, lanes, a ledger per lane, layer plans, cutover, preservation review. Use only when asked for a test-pruning campaign on a named subsystem; a targeted sweep is `test-audit`."
---

# Test-pruning campaign

The value bar, junk patterns, retention bar and candidate evidence are
[`test-audit`](../test-audit/SKILL.md); read it first. This is the order of
work. Each step ends on its completion criterion; do not start the next early.

## 1. Baseline

Pin a `main` SHA. Record the subsystem's test and support line counts and
every in-scope test file's pass/fail state. Keep baseline failures in their
own list, and note which suites cannot run in the environment (integration
and e2e without Docker) so the handoff does not claim them.

Done when every in-scope test file has a recorded result.

## 2. Lanes

Split the surface into lanes along production owner boundaries, not file
prefixes: for an API module its domain, commands, queries, controllers and
guards, adapters, and integration suite; for the runner one lane per
`internal/<module>`. Include the subsystem's cases in `apps/api/src/__tests__`
and `e2e/`.

Done when every test file belongs to exactly one lane.

## 3. Ledger

Per lane, read every test declaration in full with its production owner and
write one mark per declaration (an `it.each` or Go table is one declaration
unless its rows need different marks):

- `R` retain: the contract and the bug it catches;
- `F` fix: keep the contract, repair the assertion;
- `C` consolidate: the owner that absorbs it;
- `D` delete: the proof that remains, or why no contract exists.

Judge a test by its assertions, not its name.

Done when every declaration has a mark and an evidence line.

## 4. Layer plan

From the ledger, look for the redundant layer: a controller spec replaying a
handler's branches through a mocked bus, a handler spec replaying an entity's
invariants, a repository mock asserting what the integration suite proves.
Name the keeper per contract; prefer the real boundary with a fake port over a
mocked collaborator. Correct ledger errors this pass finds.

Done when each lane names its retired files, its keeper per contract, the
assertions carried into keepers, and the test-only seams unlocked.

## 5. Cutover

Edit lane by lane. One owner edits shared support (`apps/api/test/`, fakes
used by several suites). With each lane, remove the test-only production seams
it unlocks.

Done when every lane plan is applied and each lane's keepers pass.

## 6. Preservation review

Independent reviewers, one per boundary group, compare deleted coverage with
the keepers, looking for contracts that lost their only proof and new
assertions that cannot fail. For each restored contract, mutate the production
owner once, confirm the keeper goes red, then restore the source byte for
byte.

Done when every gap is restored or rejected with source evidence, and every
restored contract has a caught mutation.

## 7. Product defects

A baseline failure that survives into a keeper is a bug: fix it at its owner in
its own commit, with a control run that shows the old behavior. Unrelated
discrepancies become follow-ups.

## 8. Reconcile and land

Merge `main` rather than rebasing. When `main` changed a file the campaign
deleted, re-judge that file on its new content: keep the deletion only if the
new assertions have a keeper, otherwise restore it or port them. Rerun the
subsystem's suites on the merged head. Land in slices a reviewer can read,
each with its own `pnpm ci:local` report (the `steward` skill).

Hand off with the `test-audit` report plus baseline and final line counts
(production separately), lanes, retired layers and keepers, preservation gaps
and their mutations, and product defects with control proof.
