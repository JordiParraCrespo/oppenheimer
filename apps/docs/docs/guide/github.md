---
title: GitHub and pull requests
description: Connecting GitHub by installing the Oppenheimer GitHub App, which repositories sessions can reach and how git access works in a session, and the Pull requests section as built (PR queue, lanes, filters, merging, Description, Changes, review sessions, Analytics, Watched repositories).
sidebar_position: 9
---

Oppenheimer reaches your code through the **Oppenheimer GitHub App**. Signing in with GitHub and connecting GitHub are separate: you can sign in with Google or email and still connect GitHub, and the App installation, not your sign-in, decides which repositories Oppenheimer can see.

## Connecting GitHub

- During first-run, **Connect GitHub** installs the App on your account or on an organization. On GitHub's own page you choose **all repositories** or **selected** ones.
- Later, every repository picker (New session's Repositories chip, a project's repositories) ends in **Manage repository access**, which opens the App's installation page on GitHub to add or remove repositories or install it on another account.
- For an organization you do not own, the install becomes a request: an owner of the organization approves it on GitHub, then you choose Connect GitHub again and pick that organization.

Only repositories an installation covers appear in the pickers. Archived repositories are marked.

## Git in a session

- A worktree session clones the repository onto a branch of its own, `oppenheimer/<slug>`, cut from the base branch you picked.
- Git authenticates through a credential helper the runner sets up for that session: it hands git a **one-hour token scoped to the session's repositories**, minted by Oppenheimer when needed. No GitHub token is written to the host's disk. Separately, when the deployment has a key for it (`GITHUB_USER_TOKEN_KEY`), connecting GitHub keeps your own GitHub user token, encrypted in Oppenheimer's database, so the Pull requests section can comment, review and merge as you; it is refreshed as needed and dropped when it can no longer be opened or refreshed, and you are asked to connect again.
- Deleting a session pushes its branch if it has commits, then removes the worktree.
- There is no "Create pull request" button. The agent opens pull requests itself, for example with `gh pr create` (install `gh` on the host), and can then run `runner sessions watch-pr <number>` to be woken when its checks finish, it is reviewed or commented on, or it merges.
- A folder session uses your own git credentials on the host, not the App.

## Pull requests

The **Pull requests** rail item has two views in its sidebar, **PR queue** and **Analytics**, and **For review** listing your review sessions by repository.

### The PR queue

The queue reads the open pull requests of the repositories you watch.

- **Whose**: **All**, **Mine** (opened by you or your sessions), **Review requests** (someone asked for your review), **Watching** (the rest).
- **Lanes**: each pull request is placed in **Deep**, **Medium** or **Quick** by its difficulty. The order is fixed: Deep first, then Medium, then Quick, the longest wait first within a lane.
- **Filters**: a repository picker, a search over title, repository, number and author, and facets for Difficulty, Checks (passing, failing, running) and Waiting (under 1 hour, 1 hour to 1 day, over 1 day). Filters live in the address.
- Each row shows the lane, title, size, checks, conflicts and how long it has waited, with **Review** (opens the changes) and **Merge** (squash and merge into the base, after a confirm).
- Keys: `j` and `k` move, Enter opens, `/` searches, `N` opens the next one.

**Settings → Watched repositories** picks the repositories whose pull requests fill the Watching tab, even when nobody asked for your review.

### One pull request

- **Description**: the header (state, lane, number, title, author, head and base branches), the author's description with Edit on GitHub, and a rail with merge status, reviews, comments and checks. Where a bot recorded CI findings, each failing check shows its cause, whether it is flaky and the suggested action.
- **Changes**: the diff, unified or split, with a file list, Viewed marks and line comments. Comments are pending until you submit a review.
- **Submit review**: **Comment**, **Approve**, **Approve and merge** (merges now when GitHub allows, otherwise turns on GitHub's auto-merge so it merges once required checks pass), or **Request changes**. Reviews and merges are made as you on GitHub, and GitHub's branch rules still apply; if GitHub will not allow it, the pull request waits.
- **Chat**: **Start review session** starts Claude Code on one of your online hosts (the chip picks which), in a worktree of the pull request's head branch. It reads the diff, opens with two or three lines (what it changes, the riskiest part, where to look first), then waits for your questions; it asks before every edit and command. Review sessions are listed under For review, never under Sessions. Pull requests from forks cannot be checked out yet.

### Analytics

Your review over a week, month or quarter on watched repositories: pull requests created and merged per day, how many you reviewed, the median wait for review and time to merge, agent sessions against people, the lane mix, and what holds open pull requests now.

## GitHub in the rest of Oppenheimer

- **Automations** start on GitHub events such as a pull request opened, a check failed or a mention ([Automations](./automations.md)).
- **Bots** list repositories and pull requests, read them, comment, review, merge (asking first under Approve for me, one call at a time and pinned to the commit the card showed; under Full access it merges without asking unless you set merging to Ask in Settings → Permissions), start review sessions, read and open issues, and follow a pull request with a watch ([Bots](./bots.md), [Routines and watches](./routines-and-watches.md)). Issue tools need the App's Issues permission accepted on the installation.
- The **Inbox** lists review requests and your pull requests that are ready to merge.

## Not available yet

A generated summary of a pull request, a merge confidence score, per-repository policies on the Watched repositories page, notifications from GitHub, checking out pull requests from forks, and push guardrails for sessions and automations.
