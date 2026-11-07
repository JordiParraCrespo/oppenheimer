---
title: Automations
description: Automations as built, a saved prompt that starts a session on a schedule, a GitHub event or Run now, how to create one with the three-step editor, where each run starts, the limits and guards, why a run is skipped or an automation paused, and what is not built yet.
sidebar_position: 7
---

An **automation** is a saved prompt with a project, repositories, a place to run, a host, an agent and model, and one or more triggers. Any trigger starts a **run**, and each run is an ordinary session started as you, with the prompt as its first task. You watch it, type into it and delete it like any other session.

Bot routines are automations too, whose run is a turn of a bot instead of a session; they are listed here beside yours ([Routines and watches](./routines-and-watches.md)).

## Where it is

The **Automations** rail item:

- The sidebar lists automations by project, with New automation, a search, and per row a clock or GitHub mark and its status (Running, Paused, the time to the next run, or its run count). Selecting one shows its last six runs.
- **Automations** tab: a 30-day run history chart and the table (trigger, next run, status, and a row menu with Edit, Run now, Pause or Resume, Duplicate, Delete).
- **Runs** tab: every run, filtered by status (All, Completed, Failed, Running), automation, project and time window.
- **One automation**: Run now, Edit, a menu with pause, duplicate and delete, its facts line, its run history and its runs.
- **A run** opens the session it started, with the automations list kept beside it.

## Creating one

**New automation** opens an editor with three steps:

1. **Task**: a name, and what the agent should do.
2. **Trigger**: add one or more. A **schedule** (once, hourly, daily, weekdays, weekly on chosen days, monthly, at a time in your zone), or a **GitHub event** on chosen repositories, with one filter value or any. A GitHub trigger shows how many times it would have run on recent events.
3. **Where it runs**: the project and repositories, where the runs go (on a host, Claude Code's cloud from a host, or Cursor's cloud), the host, and the agent and model. These start from the project's defaults.

Create is on the last step.

## GitHub events

| Event | The run starts on |
| --- | --- |
| Pull request opened, Draft opened, Pull request pushed, Pull request merged, Check failed, Checks passed, Review submitted | the pull request's head branch |
| Push to branch | the pushed branch |
| Comment added, Label added, Issue opened, Mentioned @oppenheimer, Release published, a schedule, Run now | a fresh worktree on the default branch |

The event's details reach the agent after the prompt, marked as outside data it should not take instructions from. Events caused by Oppenheimer's own GitHub App never trigger a run. A run may push to any branch its token reaches; there are no push guardrails yet.

## Pausing and Run now

A paused automation ignores its triggers; **Run now** still works. Oppenheimer pauses an automation itself, with the reason in a band on its page, when:

- its project was deleted (move it to another project to resume);
- its host was removed (pick another host in Edit);
- its owner can no longer run it;
- its cloud provider has no key or refused it (connect it in **Settings → Cloud agents**).

## Limits and guards

| Limit | Default |
| --- | --- |
| Runs per automation per hour | 10 |
| Runs per workspace per hour | 100 |
| Live automation runs per host | 2 (your own sessions never count) |
| A run still going when the next fires | skipped |
| A run left pending (host offline, host full, under 5 GB free disk) | expires after 1 hour |
| A scheduled slot missed while it could not run | skipped after 15 minutes |
| Maximum run duration | 1 hour, then its session is stopped |

A skipped run is still listed, with its reason: paused, deleted, own event, hourly limit, still running, missed slot, could not start, or agent not on the host.

Deleting an automation stops its triggers and keeps its runs, which read "Deleted automation".

## From elsewhere

- `opp automations list | create | run | pause | resume | delete` and the MCP server's automation tools ([CLI and MCP](./cli-and-mcp.md)).
- Bots can list automations and read their run history, but cannot create, change or run your automations.
- Plan's calendar shows when scheduled automations will run (hourly ones are left off).
- A failed run in the last day shows in the [Inbox](./inbox.md) with **Run again**.

## Not built yet

- Templates.
- Headless runs: every run is an interactive session in a terminal; there is no structured result beside it.
- Resuming or continuing a finished run from its page, and keeping its worktree after the run.
- Slack and Linear triggers, push guardrails, and handing an automation to someone else.
