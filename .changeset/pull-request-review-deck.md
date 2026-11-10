---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": minor
---

The review deck: the PR queue one pull request at a time.

- `@oppenheimer/api`: `GET /v1/pulls/:installationId/:githubRepoId/:number/brief`
  answers a pull request's brief for its head commit (one sentence, up to four
  points, where to look first, the description's pictures), written by the
  deployment's model (`LLM_*`) and kept per commit, or taken from the
  description when there is no model.
- `@oppenheimer/web`: `/pulls/review`, a third view in the Pull requests
  sidebar. A full-width card per pull request with its brief and one
  link to review it in depth; Pass, Comment or Request changes, Approve,
  Approve and merge and Merge each move to the next card, by button or key. Review next in the queue opens it, and a pull
  request opened from a card goes Back to that card.
- `@oppenheimer/frontend-consumer`: `useSuspensePullRequestBrief`,
  `usePrefetchPullRequestBrief` and the `PullRequestBrief` type.
- `@oppenheimer/api-client`: regenerated.
- `@oppenheimer/translations`: `pullRequests.deck` (its buttons reuse `pullRequests.review`), `pullRequests.sidebar.review`
  and `pullRequests.detail.backToDeck`.
