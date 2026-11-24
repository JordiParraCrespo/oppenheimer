# Results

## 2026-11-23: the hunt list and the new rules, against what they replace

The reviewer is `claude-sonnet-5-5`. `old` is the skill and the rules at
`7d1622d2`, before this eval's pull request. `new` is the same pull request's
head. The fixtures were the same for both.

### One case at a time

Each case was alone on its branch, one trial each.

| | Planted bugs caught | Decoys clean | Cost |
| --- | --- | --- | --- |
| old | 13/13 | 3/4 | $2.19 |
| new | 12/13 (one unparsed) | 3/4 | $2.04 |

A lone case in a forty-line diff is too easy to tell the two apart: both
reviewers found every bug. The unparsed answer was the grader's fault: a
summary quoted a code fence, and the parser stopped at it; it now reads to the
answer's last fence.

The decoy both runs flagged, `cap-atomic-ok`, was a real bug in the decoy.
Re-allowing a group already granted hit `ON CONFLICT DO NOTHING`, returned no
row, and read as "cap reached". The decoy now re-points the group and counts
it as taking no new slot. Re-run alone, three trials each, it came back clean
3/3 on both.

### Bundles

`--bundles --trials 3`: several cases land as one branch, the way autoreview
meets a real one, and each case is graded on its own.

| | Planted bugs caught | Decoys clean | Cost | Median review |
| --- | --- | --- | --- | --- |
| old | 29/42 | 11/12 | $1.66 | 43 s |
| new | **42/42** | **12/12** | $1.61 | 50 s |

What the old brief missed, out of three trials each:

| Case | old | new |
| --- | --- | --- |
| `cap-after-buffering` | 0/3 | 3/3 |
| `cron-step-words` | 0/3 | 3/3 |
| `draft-lost-on-error` | 0/3 | 3/3 |
| `enter-during-ime` | 1/3 | 3/3 |
| `failure-drawn-as-empty` | 1/3 | 3/3 |
| every other planted case | 3/3 | 3/3 |

These are the kinds of bug Codex kept finding after autoreview said `CLEAN`:
limits, schedules, failure paths and keyboard input. In a bundle, the old
reviewer spent its attention on the security and race cases and passed over
these. The hunt list makes it walk each kind on every file.

What this does not show: three trials per bundle is a small sample, and every
fixture is shorter than a real branch. Run it again when the brief or the
model changes, and add a case for each new kind of bug a bot finds after a
`CLEAN`.
