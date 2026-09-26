# Eval results

## 2026-09-26 — first two iterations

Fixture: `main` @ 3496e36 plus `plant.mjs`. There was one run per version.
LLM output varies, so a single run is a smoke test, not a benchmark. Re-run
when a number looks borderline.

| | v1 planted | v1 clean | v2 planted | v2 clean |
| --- | --- | --- | --- | --- |
| Planted items caught (of 13) | **13** | – | **13** | – |
| Decoys under Findings (N1–N5) | 0 | 0 | 0 | 0 |
| Decoys mentioned anywhere | 1 (N1 as "not a finding") | 0 | 0 | 1 (N3, as a rule-vs-reference note) |
| Rows under Findings | 17 | 1 | 14 | **0** |
| Rows that are one pattern repeated | 4 (profile `resolveUrl` ×4) | – | 0 (grouped into 1) | – |
| Mechanical breach (P8) reported as blocking | ✅ | – | ✅ | – |
| Ledger addition (P11) caught | ✅ | – | ✅ | – |
| Ledger counts consistent across runs | – | 12 | 21 ❌ | 12 |

**Pass bar** (`cases.json`): recall ≥ 0.85, zero decoys under Findings, and
every finding cites a rule. v1 and v2 both pass. v2 is the version that ships.

### What v1 got wrong, and what changed

1. **Severity inflation.** Every finding was "blocking", including a
   pagination envelope that all four list endpoints (the reference `users/`
   among them) build in the controller. v2 defines blocking as "changes
   behaviour or the contract", and adds **systemic**: a pattern in three or more
   modules is reported once, as drift, flagged as the rule and the code
   disagreeing.
2. **One pattern, many rows.** Four `profile/` controllers calling the same port
   became four blocking rows. v2 reports one row per pattern and lists the
   occurrences in the evidence.
3. **Noise about allowed code.** The decoy `throw new Error` in the queue
   processor turned up under "Worth a look" as "not a finding". v2 says:
   something verified as allowed goes nowhere.
4. **Rule vs reference.** Several reviewers hit "the rule forbids X, but
   `users/` does X". v2 makes that one "Worth a look" line naming both sides, so
   the daily issue stops relitigating it.
5. **Fix PRs on design questions.** Found in the current-state sweep, not the
   eval: seven `sessions` handlers share one `{ session, hints }` result type.
   v2 bars systemic and multi-occurrence findings from the fix PR.
6. **Ledger counting** drifted between runs (12, then 21, against a true count
   of 25), because the agents counted by eye. The prompt now gives the exact
   `grep` commands.

### Things the eval does not cover yet

- Step 7 (the fix PR) and GitHub publishing. They are tested by the first
  scheduled runs; check the first few PRs by hand.
- The `--since 26 hours ago` date path. Every eval uses a git ref.
- Variance. Run each case three times before trusting a small change in the
  numbers.
