---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

A bot can follow a pull request. `watch_pull_request { repository, number,
purpose? }` subscribes it to an open pull request of a repository its owner
can read through the workspace's GitHub installations, and
`unwatch_pull_request` stops it; `list_watches` lists pull requests beside
sessions. A failing or passing check, a submitted review, a comment or the
merge on it wakes the bot with one queued turn per stored GitHub event, made
only of the event's metadata (kind, number, repository, check name and
conclusion, review state, actor login, each held to what GitHub allows) and
never anyone's words; the bot reads them with `get_pull_request`. Our own
app's events wake nobody. A merge ends the subscription after its wake; the
wake limit (20) and the per-bot limit (50, sessions and pull requests
together) are the session watches'.

`bot_subscription` gains the `pull_request` kind: `resourceId` is nullable,
and `githubRepoId`, `pullNumber` and `repositoryFullName` name the pull
request, tied to the kind by `CHK_bot_subscription_subject`, with a unique
index per bot and pull request and an index for the webhook's read. The chat
draws the wake as one line, "Pull request #128 of acme/app: checks failed",
from a new `pull_request` event kind. `PULL_REQUEST_WAKE_EVENTS` in
`@oppenheimer/shared` is the one list a session's agent and a bot are woken
by.
