<!-- What the pull request watch tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-pull-request-watch-tools.factory.ts`, `bot-pull-request-watch.resolver.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: repository-repository-id-from -->

The repository id from list_repositories.

<!-- fragment: repository-repository-owner-name -->

The repository: "owner/name", or its github_repo_id (from list_pull_requests or list_repositories).

<!-- fragment: watch-pull-request -->

Subscribes you to an open pull request, so you are woken with a turn of your own when a check fails or passes, a review is submitted, someone comments, or it is merged: no need to poll it. You are told what happened and by whom, never what anyone wrote: read it with get_pull_request. It ends when the pull request is merged, after {{subscriptionWakeLimit}} wakes, or with unwatch_pull_request. Only a repository the workspace's GitHub installations let the person read; at most {{subscriptionsPerBot}} sessions and pull requests followed at once.

<!-- fragment: watch-pull-request-purpose -->

Why you follow it, in a line; you are reminded of it when it wakes you.

<!-- fragment: watch-pull-request-follow-pull-request -->

You follow pull request #{{number}} of {{repository}} (installation {{installationId}}, repository id {{githubRepoId}}). You will be woken when a check fails or passes, a review is submitted, someone comments, or it is merged; end your turn now rather than wait for it.

<!-- fragment: unwatch-pull-request -->

Stops following a pull request: it will no longer wake you. The pull request itself is untouched.

<!-- fragment: watch -->

Pull request #{{number}} of {{fullName}} is {{state}}: there is nothing left to follow.

<!-- fragment: assert-room -->

You already follow {{subscriptionsPerBot}} sessions and pull requests. Unwatch one you no longer need (list_watches shows them) first.

<!-- fragment: find-repository-github-connected-workspace -->

GitHub is not connected to this workspace, or its installations are suspended: there is no pull request you can follow.

<!-- fragment: find-repository-installation-could-listed -->

({{unlisted}} installation{{suffix}} could not be listed just now; try again later)

<!-- fragment: find-repository-repository-one-workspaces -->

Repository {{handle}} is not one the workspace's GitHub installations let its owner read{{why}}. list_repositories shows the ones you can follow.
