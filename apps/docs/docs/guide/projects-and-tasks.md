---
title: Projects and tasks
description: Projects (repositories, default host and agent, the Unassigned project, making, editing and deleting them in Plan → Projects) and the rest of Plan as built, the Tasks board, starting a session from a task, Milestones, and the Calendar with Google Calendar.
sidebar_position: 4
---

**Plan** is the rail item for organising work. Its sidebar has **Inbox**, **Tasks**, **Milestones**, **Calendar** and **Projects**. The Inbox has its own page: [Inbox](./inbox.md).

## Projects

A project is a saved scope with a name, zero or more repositories (each with a base branch), and defaults for new sessions: a host, an agent, and which repositories are cloned by default. Sessions, tasks, milestones and automations are filed under a project.

- A project is metadata only. Moving a session to another project (**Move to project…** in the session's menu) changes nothing on the host: the folder, branch and running agent stay as they are.
- A session that names no project is listed under **Unassigned**, a project every workspace has. It cannot be deleted or renamed away.
- A project with no repositories is allowed: it holds folder sessions, terminal sessions, tasks and milestones.

**Plan → Projects** is where projects are made and edited: it lists each project with its repositories, **New project** in the header, and each project's settings. New session's project chip also ends in **New project…**. The dialog has the name, the repositories (picked from what the GitHub App can reach; "Manage repository access" adds more on GitHub), and the optional defaults.

**Delete project** archives it: nothing new goes in it and the automations aimed at it are paused (they stay paused if it comes back). It is refused while the project has open sessions; move or delete them first. A deleted project's sessions and history stay.

## The Tasks board

**Plan → Tasks** is one board for the workspace, filtered by **Project** and **Milestone** at the top (each view remembers its filter on this device). Columns, in order: **To do**, **In progress**, **In review**, **Done**. The header counts open, in progress, done and overdue tasks.

- **New task** (or `n`) opens the task dialog: title, notes, Status, Project, Milestone, Sessions and Due (a date with Today, Tomorrow, Next Monday, and an optional time).
- **Add task** at a column's foot adds a one-line task to that column under the current filter.
- Drag cards within and across columns. Ticking a card's checkbox moves it to Done.
- A card shows its title, notes, project, milestone, due date (red when overdue) and its session line.

Tasks have no assignee, since a workspace has one person. Tasks are Oppenheimer's own; there is no import from GitHub Issues or Linear.

## Tasks and sessions

A task is where work is asked for; a session is where it is done.

- **Start session** (on a card with no session, or in the dialog's Sessions row) opens a dialog with a prompt prefilled from the title and notes, the **Repository** (the project's), **Where it runs** (on a host, Claude Code cloud from a host, or Cursor's cloud), the **Host**, and the **Agent and model**. The session starts at the Approve for me permission level. If the host is offline the button reads **Queue session** and the session starts when the host is back.
- **Link existing** links sessions you already have; a session can be linked to several tasks.
- Starting or linking a session moves a task that is in To do to **In progress**. No other move is automatic.
- The card's session line shows the linked session that most needs attention (Needs input first). Inside that session, a **Back to task** chip returns to the task.

Deleting a task leaves its sessions as they are.

## Milestones

A milestone splits a project into stages with a target date (End of month and In 3 months are shortcuts). **Plan → Milestones** shows a project's milestones on a timeline, each with its progress: the share of its tasks that are done. A milestone without a target date has no place on the timeline but is still a filter on the board and a choice in the task dialog. Deleting a milestone keeps its tasks, without a milestone.

## Calendar

**Plan → Calendar** is a month view with four layers you can switch in the sidebar:

| Layer | What it shows | Editable |
| --- | --- | --- |
| Personal | Events you create here (New event, or `n`): title, all day or times, notes | Yes; drag to another day |
| Google Calendar | Events from connected Google accounts, each in its account's colour | No: read-only, change them in Google |
| Task due dates | Tasks with a due date | Drag moves the due date |
| Automations | When scheduled automations will run (hourly ones are left off) | No |

The header counts the month's meetings, tasks due and automation runs. Times are read in your browser's time zone.

**Connecting Google Calendar**: use the Google Calendar card in the calendar's sidebar (**Connect Google Calendar**, then **Add account** for more, up to five). Nothing is written to Google. A Google event opens read-only, with **Open in Google Calendar**, and **Join meeting** when it is a Meet, Zoom, Teams or Webex meeting. Remove an account from the same card. There is no separate Settings page for it.

## What bots can do here

Bots can list and read projects, tasks and milestones, create and edit tasks and move them between columns, create and edit projects, move sessions between projects, and archive (always asking first) or restore a project. They cannot read or edit the calendar. See [Bots](./bots.md).
