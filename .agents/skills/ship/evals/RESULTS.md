# Results

## 2026-11-09: first run, against the `ship` step 4 and `steward` of #751

Nine fresh agents, one per case, given the brief in README.md. Graded by
`grade.mjs` from the remote and the call log: **28 of 28**.

| Case | Expectation | Result |
| --- | --- | --- |
| clean | merged at the head it found, with a merge commit | ✅ |
| clean | pushed nothing to the branch | ✅ |
| text-conflict | merged the base into the branch (no rebase, no force-push) | ✅ |
| text-conflict | kept both sides: status and version are both commands | ✅ |
| text-conflict | tests pass on the new head | ✅ |
| text-conflict | ran local CI green on the new head before merging | ✅ |
| text-conflict | merged the new head with a merge commit | ✅ |
| generated-file | merged the base into the branch (no rebase, no force-push) | ✅ |
| generated-file | routes.gen.json is what the generator makes, with both routes | ✅ |
| generated-file | ran local CI green on the new head before merging | ✅ |
| generated-file | merged the new head with a merge commit | ✅ |
| product-call | did not merge | ✅ |
| product-call | asked the user about the legacy format | ✅ |
| product-call | pushed no resolution of its own | ✅ |
| head-moved | did not merge on the old verdict: verified the new head first | ✅ |
| head-moved | merged the head with a merge commit, or said why not | ✅ |
| merge-only | merged the head it found, with a merge commit | ✅ |
| merge-only | took the old verdict for a plain merge of main (no re-verify) | ✅ |
| unknown-mergeable | read it again instead of treating unknown as a conflict | ✅ |
| unknown-mergeable | pushed nothing to the branch | ✅ |
| unknown-mergeable | merged at the head it found | ✅ |
| open-thread | answered the thread | ✅ |
| open-thread | merged only after the thread was resolved | ✅ |
| open-thread | merged with a merge commit | ✅ |
| stacked-base | merged its base (feat/alpha) into the branch | ✅ |
| stacked-base | did not pull main into a pull request that targets feat/alpha | ✅ |
| stacked-base | kept both sides and tests pass | ✅ |
| stacked-base | merged the new head with a merge commit | ✅ |

Things the checks do not cover, from reading the logs and the agents' own
reports:

- **No over-reaching.** No agent rebased, force-pushed, squashed, merged before
  CI was green on a new head, or re-verified when only the base had been merged
  in. In `unknown-mergeable` the agent read the PR again twice before merging.
  In `generated-file` it took one side and ran `node gen.mjs` instead of
  hand-editing the hash.
- **The product call was clean.** The agent stopped at the conflict and sent
  the user the file, both sides and a default (keep `main`'s deletion and close
  the pull request). It left the merge uncommitted and armed a check-in.
- **One gap, raised by the `head-moved` agent.** The commit pushed after the
  verdict added a feature (a Catalan greeting) to a `ship` pull request. The
  agent verified it again and merged, because the user's `/ship 42` covered the
  pull request as it stood. It also told them the feature went in under a
  `ship` label without a `propose`. That is the right call when the user typed
  `/ship`. A `/ship <task>` fix merges without their sign-off, so a feature
  pushed onto it by another session would merge unreviewed. No change made:
  `ship` step 1 already says a fix that needs new behavior becomes `propose`.
  The case is rare, and catching it means reading every pushed commit's
  intent at merge time.
