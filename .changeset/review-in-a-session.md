---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": minor
"@oppenheimer/shared": minor
---

Review sessions: a pull request's Chat tab starts Claude Code on one of your hosts, in a worktree of its head branch, on a review prompt that opens with a two-or-three-line take, then shows its terminal with an input line under it. Review sessions are listed under For review in the Pull requests sidebar and left out of Sessions (`origin = 'review'`, `pull_request_review_session`). New routes: `POST /pulls/…/review-session` and `GET /pulls/review-sessions`; a fork's pull request is `PULLS_002`. The pull request detail says whether its head is in a fork (`fromFork`).
