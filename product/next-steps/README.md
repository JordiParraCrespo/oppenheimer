# Next steps

What comes after the MVP, one version at a time. The MVP itself is
[`../versions/mvp/`](../versions/mvp/README.md) and is 0.1. This list is
the owner's order as of 2026-09-26; each version has a document here
that starts as a sketch (the goal, what already exists to build on, the
questions to answer first) and grows into a design the way the MVP
documents did. When a version's design is real enough to need several
documents, it moves to `../versions/<version>/` and the file here points
there.

| Version | Document | Theme |
|---------|----------|-------|
| 0.1 | [`../versions/mvp/`](../versions/mvp/README.md) | The MVP: hosts you own, sessions as worktrees with a tmux terminal, Claude Code first |
| 0.2 | [Git and GitHub](0.2-git-and-github.md) | Git, aka GitHub support: diff, review, commit, push and PRs from the console |
| 0.3 | [Plan](../versions/0.3/README.md) (sketch: [Kanban](0.3-kanban.md)) | Plan: a task board with goals, tasks that start or link sessions, and a calendar beside Google Calendar |
| 0.4 | [Slack](0.4-slack.md) | The Slack integration |
| 0.5 | [Mobile](0.5-mobile.md) | Mobile |
| 0.6 | [MCP, CLI and agent](0.6-mcp-cli-and-agent.md) | An MCP server, a CLI and an agent over the same API |
| 0.7 | [Terminal and chat display](0.7-terminal-and-chat.md) | Improve the terminal, and a chat display beside it |
| — | [Multi-account](multi-account.md) | Several agent accounts per person (note 06); on the list, version not set |

## What this list does not place yet

The MVP notes name VMs (with sleep tiers), the accounts model and Codex
as "the slices after" (`../versions/mvp/00-scope.md`, `brief.html`). The
accounts model is on this list as multi-account, but it has no version
yet. VMs and Codex are not on the list at all. Nothing is cancelled;
where these land is the first open question below.

## Open questions

1. Which version gets multi-account, and where do VMs and sleep tiers
   and the host settings drawer land relative to 0.2 to 0.7?
2. Is each version a release with a version number the runner and the
   console both carry, or a product milestone only? The runner already
   ships signed, versioned releases (`../versions/mvp/09-runner-install-and-update.md`).
3. What is each version's demo scene, the way `../versions/mvp/00-scope.md`
   has one for the MVP?

## Decision log

- 2026-09-26: directory created with the order 0.2 Git/GitHub, 0.3
  Kanban, 0.4 Slack, 0.5 Mobile, 0.6 MCP/CLI/agent, 0.7 terminal and
  chat display.
- 2026-09-26: multi-account added, version not yet set.
- 2026-10-05: 0.3 grew from the Kanban sketch into Plan (tasks, goals,
  calendar) after the design export drew it; the design moved to
  `../versions/0.3/`.
