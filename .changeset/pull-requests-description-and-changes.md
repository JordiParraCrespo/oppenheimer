---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/web-showcase": minor
"@oppenheimer/translations": minor
---

Pull requests on the 2026-10-13 screens, without the chat and the review
agent.

- `@oppenheimer/shared`, `@oppenheimer/api`, `@oppenheimer/api-client`: a
  review's verdict is `comment`, `approve`, `approve_and_merge` or
  `request_changes`. `approve` only approves now; `approve_and_merge`
  merges at once when GitHub allows it and otherwise turns on GitHub's
  auto-merge, answering `{ merged, autoMerge }`. The queue is ordered by
  lane (Deep first) and then the longest wait, and the path to merge is
  three gates (checks, conflicts, merge).
- `@oppenheimer/frontend-consumer`: `ReviewOutcome`; the activity read
  (`usePullRequestActivity`) is removed.
- `@oppenheimer/web`: a pull request is Description and Changes (a link to
  `?view=briefing` opens the description); the queue filters by repository,
  Difficulty, Checks and Waiting, with `j`/`k`, Enter and `/`; Review opens
  the changes; Settings → Watched repositories is where watching is set.
- `@oppenheimer/design-system-web`: `MergePath` is the one-row status strip;
  `PullRequestTable` folds in three widths (1080px, 720px); `ChipSelect`
  options take a `count`. `FactTile`, `FactGrid`, `DiffCommentLink` and the
  Stepper's horizontal orientation are removed.
- `@oppenheimer/translations`: the new queue, review, Settings and toast
  copy; the briefing, rail, activity and lane-reason keys are removed.
