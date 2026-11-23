# Autoreview eval

Does the reviewer `/autoreview` spawns catch the bugs it let through, and stay
quiet about the same code done right? In the last two hundred pull requests,
autoreview said `CLEAN` on nineteen where a bot then found a real bug, and
the misses fell into a handful of kinds: an input nobody tried, a race, a
failure drawn as success, a scope that grants more than its name, an id
matched by name, a rename that left a caller behind. Each planted case here is
a small copy of one of them, named after the pull request it came from; each
decoy is the same change done right.

| Case | From | The bug |
| --- | --- | --- |
| `surrogate-cut` | #959 | `slice` on UTF-16 splits an emoji, and jsonb refuses the lone surrogate |
| `count-then-insert` | #931 | a cap checked with a count, then an insert: two allows pass it |
| `draft-lost-on-error` | #881 | the composer clears on send and a failed send loses the text |
| `control-under-write-scope` | #799 | a shell on the host behind `hosts:write` |
| `denylist-fails-open` | #802 | a command the guard cannot parse runs, and `git -C` hides `push --force` |
| `match-by-branch-name` | #958 | a fork's branch of the same name matches another bot's session |
| `markdown-rewrites-code` | #961 | `**` inside a code span becomes `*` |
| `cron-step-words` | #957 | `*/25` is worded "every 25 minutes" but fires at :00, :25, :50 |
| `rename-leaves-a-caller` | #871 | a rename updates one caller and leaves another importing the old name |
| `late-save-wins` | #884 | two drags answer out of order and the older order comes back |
| `enter-during-ime` | #904 | Enter confirming Japanese input adds a tag |
| `cap-after-buffering` | #962 | the size cap is checked after the whole body is in memory |
| `failure-drawn-as-empty` | #900 | a failed hosts read draws "Connect a host" |

The decoys are `surrogate-cut-ok`, `cap-atomic-ok`, `match-by-id-ok` and
`enter-during-ime-ok`.

A case's files under `cases/<id>/` are laid over a throwaway worktree at their
own paths and committed as the branch under review; `base/<id>/` holds code
older than the branch, committed first. `scripts/evals` is removed from the
worktree, so the reviewer cannot read the expectations. The reviewer gets the
prompt in `cases.json`: follow the brief in `.agents/skills/autoreview/SKILL.md`,
then end with a JSON block of findings.

```bash
node scripts/evals/autoreview/run.mjs --validate                 # the fixtures, no agent (CI runs run.test.mjs)
node scripts/evals/autoreview/run.mjs                            # every case, the skill and rules at HEAD
node scripts/evals/autoreview/run.mjs --ref origin/main          # the same, with main's skill and rules
node scripts/evals/autoreview/run.mjs --case surrogate-cut --trials 3
node scripts/evals/autoreview/run.mjs --grade results/<report>.json
```

Grading:

- a planted case passes when a `P0` or `P1` finding sits on one of the files
  in its `expect.files` and its summary matches `expect.match`;
- a decoy passes when no `P0` or `P1` finding sits on any of its files;
- an answer with no JSON block is unparsed, which is a failure.

Run it when the autoreview brief, its hunt list, or the rules it points at
(`edge-cases.md`, `client-state.md`, the concurrency and scope sections)
change, and when the model the reviewer runs on changes. Compare with
`--ref origin/main` so a change is measured against what it replaces, and add
the table to `RESULTS.md`.

`validate` refuses a case that overwrites a file the repository already has,
since the diff would then show the repository's code and not the case's, and
a case that expects a finding on a file it does not add.
