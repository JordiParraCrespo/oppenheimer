<!-- What the pull request tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-pull-request-tools.factory.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: address-installation-id -->

The installation id from list_pull_requests.

<!-- fragment: address-github-repo-id -->

The repository id from list_pull_requests or list_repositories.

<!-- fragment: line-comment-path -->

The file, as get_pull_request lists it.

<!-- fragment: line-comment-side -->

RIGHT (default) is the new file, LEFT the old.

<!-- fragment: ci-finding-check -->

The failing check, exactly as get_pull_request names it.

<!-- fragment: ci-finding-root-cause -->

Why it failed, in a sentence or two: the error, where, and what made it.

<!-- fragment: ci-finding-relation -->

"this_change": the pull request caused it. "unrelated": it fails without it (the base, the runner, another change). "unclear": you could not tell.

<!-- fragment: ci-finding-flake -->

"flake": it passes on a re-run of the same commit. "real": it fails the same way each time. "unsure": not re-run or not known.

<!-- fragment: ci-finding-action -->

"fix_here": change this pull request. "rerun": run it again. "fix_elsewhere": the fix belongs in another change. "ask": the person must decide.

<!-- fragment: ci-finding-next -->

The action in words: what exactly to change, re-run or ask.

<!-- fragment: ci-finding-evidence -->

What it rests on: a line of the log, a file and line, a run you compared.

<!-- fragment: record-ci-findings -->

Records what the failing checks on a pull request came to, one finding per check you looked into: why it failed, whether this change caused it, whether it is a flake, what to do, how sure you are, and the evidence. It is kept on the pull request's head and shown with its checks, so the person reads a verdict rather than a chat; a second record of a check on the same commit replaces the first. Read the failing checks with get_pull_request first, and look at a check's log before you judge it. At most {{ciFindingsPerRecordMax}} checks per call. It writes nothing to GitHub.

<!-- fragment: record-ci-findings-done -->

Recorded {{findingsCount}} finding{{suffix}} on #{{number}} at {{headSha}}: {{checks}}. The person sees them with the pull request's checks; a push leaves them on the commit before.

<!-- fragment: comment-on-pull-request -->

Posts a comment on a pull request in the person's name: on its conversation, or on one line of its diff when path and line are given. Use review_pull_request to approve or ask for changes instead.

<!-- fragment: comment-on-pull-request-path -->

Only for a line comment: the file, as get_pull_request lists it.

<!-- fragment: comment-on-pull-request-line -->

With path: the line in the diff.

<!-- fragment: comment-on-pull-request-side -->

With path: RIGHT is the new file.

<!-- fragment: comment-on-pull-request-message -->

A line comment needs both path and line; leave both out to comment on the conversation.

<!-- fragment: comment-on-line-done -->

Commented on {{path}}:{{line}} of pull request #{{number}}.

<!-- fragment: comment-done -->

Commented on pull request #{{number}}: {{htmlUrl}}

<!-- fragment: review-pull-request -->

Submits a review in the person's name: approve, request changes, or comment, with an optional summary and up to 50 line comments. Approving does not merge; use merge_pull_request for that. Requesting changes or commenting needs a body or a line comment.

<!-- fragment: review-pull-request-verdict -->

approve, request_changes, or comment (neither).

<!-- fragment: review-pull-request-message -->

Requesting changes or commenting needs a body or a line comment.

<!-- fragment: review-submitted -->

Submitted the review ({{verdict}}) on pull request #{{number}}.

<!-- fragment: merge-pull-request -->

Merges an open pull request in the person's name, squash by default, at the head commit get_pull_request showed: if anything was pushed since, nothing merges and you should read it again. GitHub's branch rules decide; when they hold it (checks, a required review, a conflict), the answer says so and nothing is forced. Only an answer that says it merged is a merge; get_pull_request confirms its state.

<!-- fragment: merge-pull-request-method -->

How to merge; squash unless the repository or the person wants another.

<!-- fragment: merge-pull-request-head-sha -->

The full head commit get_pull_request showed; the merge is refused if the head has moved since. The current head when omitted.

<!-- fragment: merge-nothing-to-merge -->

Pull request #{{number}} is {{state}}; there is nothing to merge.

<!-- fragment: merge-new-commits -->

New commits were pushed to #{{number}} since you read it (head is now {{headSha}}). Read it again with get_pull_request before merging.

<!-- fragment: start-review-session -->

Starts a review session for a pull request: a worktree of its head branch on a host, with Claude Code reviewing it. It returns at once with the session's id; if the host is offline the answer says it is queued. You are subscribed to it unless watch is false, so end your turn rather than check on it. The host defaults to your home host (not the project's default: a pull request names no project). A pull request from a fork cannot be reviewed this way.

<!-- fragment: start-review-session-host-id -->

The host to run on (from list_hosts).

<!-- fragment: start-review-session-watch -->

Be woken when the review needs input, ends or fails (default true).

<!-- fragment: start-review-session-normalize -->

You have no home host; ask the person which host (list_hosts) to review on.

<!-- fragment: review-session-host-offline -->

The host is offline: the session is queued and starts when it comes back.

<!-- fragment: review-session-not-watched -->

You are not watching it; read it later with get_session.

<!-- fragment: start-review-session-content -->

Started review session {{sessionId}} for pull request #{{number}} on host {{hostId}}.{{offline}} {{watched}}
