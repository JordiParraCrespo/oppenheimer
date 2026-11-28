# Hidden sessions

**Goal:** the person keeps the Sessions sidebar for the work they follow. A
bot, a script or an agent can start sessions the person does not need to
watch, hidden, and the person shows them whenever they want. Proposed
2026-11-10, version not set.

## What hidden means

- **Display only.** A hidden session runs, wakes, notifies the Inbox and
  answers the API like any other. Only the console's sidebar leaves it out.
- **The API's, not the device's.** Unlike a hidden project
  (`apps/web/src/features/sessions/lib/hidden-projects.ts`), whether a
  session is hidden is stored on the session, so the person's other devices
  and the bot that started it agree. A bot can only start a session hidden
  if the flag lives on the session.
- **An entry in the session's log.** `session.visibility_set` with
  `{ hidden }`, folded into `work_session.hidden` the same way
  `session.named` is folded into `name`. A console that is open hears of it
  the way it hears of any other change, and replaying the log rebuilds it.
  A closed session takes it too.

## Who sets it

| Who | How |
| --- | --- |
| A bot | `start_session` / `start_cloud_session` with `hidden: true` (on the approval card: "hidden from your sidebar") |
| An MCP client | `start_session` with `hidden`; `set_session_visibility` |
| `opp` | `opp sessions run --hidden`; `opp sessions hide <id>`, `opp sessions show <id>` |
| The API | `POST /sessions` (and `/sessions/cloud`) with `hidden`; `PUT /sessions/{id}/visibility` |
| The person | **Hide** / **Show** in a session row's menu |

## How the person sees them

The filter menu has a **Show hidden sessions** toggle with a count of how
many sessions are hidden, so none is ever lost. When the toggle is on, hidden
sessions are listed in their projects and marked **Hidden**. The toggle is
kept on the device, like Pinned only. A hidden session is left out of the
sidebar even when it is pinned. `GET /sessions` still returns hidden
sessions, with `hidden` set, so a bot can follow the ones it started.

## Open questions

1. Should a bot's sessions start hidden by default, or only when the bot
   asks? Default here: only when it asks.
2. When the Inbox reports a hidden session (a question, a notice), should
   it unhide the session? Default here: no. The Inbox links to the session
   either way.
3. Should hiding a session be its own toggle, or the same thing as the
   project-level hide? Default here: its own. Project hiding is per device;
   session hiding is shared.
