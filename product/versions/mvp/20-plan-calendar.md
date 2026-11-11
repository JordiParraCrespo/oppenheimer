# 20 — Plan: the calendar

Plan's second section is a month view that shows four **layers**, each
with a toggle in the sidebar: **Google Calendar**, **Personal**, **Task
due dates** and **Automations**. The header counts what the month holds:
*n meetings · n tasks due · n automation runs*. The frames draw a month
grid only (Monday first, today circled, "n more" past four items a day,
compact times under 150 px a column).

The view is **composed in the console from four reads**, one per layer,
each owned by the module whose rows they are:

| Layer | Owner | Request |
|-------|-------|---------|
| Task due dates | `tasks` (19) | `GET /tasks?dueFrom&dueTo` |
| Automations | `automations` | `GET /automations/occurrences?from&to` (new, §3) |
| Google Calendar | `calendar`, read through to Google | `GET /calendar/google/events?from&to` (§5) |
| Personal | `calendar` | `GET /calendar/events?from&to` (§2) |

A layer toggle is a query enabled or not, each read is cached in the
console's query client for the open month, and nothing on the server
joins across modules. Every route here was to be behind the `plan`
flag (19 §8); as built there is none, and the automations layer is
computed in the console (17 "As built").

## 1. What each item does

- **Event**: time and title; busy events in full colour, free ones
  muted; all-day events as a filled bar. A personal event opens the
  event dialog and drags to another day. A Google event opens read-only
  with "Open in Google Calendar" and does not drag (17, decided 2).
  > Since 2026-10-20 a Google event that is a video meeting also offers
  > **Join meeting** there, the dialog's one primary button, opening the
  > meeting in a new tab; the layer stays read-only (§5).
- **Task due**: a check-circle and the title, struck through when Done.
  Click opens the task dialog; drag to another day sets its due date
  (`PATCH /tasks/:id`).
- **Automation run**: a bolt, time and name, muted; click goes to the
  automation. Not draggable.
- **Day cell**: click on empty space opens New event on that day.

## 2. Personal events

Personal events stay (17, decided 3). They are the only events Plan
stores, in one table with one shape:

**`calendar_event`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `organizationId` | uuid | the tenant key, as for tasks |
| `title` | varchar(500) | |
| `notes` | text | |
| `allDay` | boolean | |
| `startsAt`, `endsAt` | timestamptz null | timed events |
| `startDate`, `endDate` | date null | all-day events (end exclusive) |
| `busy` | boolean | |
| `createdByUserId` | uuid | |
| `createdAt`, `updatedAt` | timestamptz | |

`CHECK` that exactly one of the timed pair and the all-day pair is set.
Indexes `(organizationId, startsAt)` and `(organizationId, startDate)`
for the range query. No recurrence; the frames draw none.

**Visibility:** personal events belong to the workspace, like tasks,
because Plan is a workspace page. Workspaces have one member today;
whether teammates see each other's personal events is a question for
when teams come, not now.

The event dialog: title, notes, date, All day, start and end on a
15-minute grid (end shows the duration), Busy / Free, Delete event.
`POST/PATCH/DELETE /calendar/events`. Scope resource `calendar`
(`calendar:read`, `calendar:write`).

## 3. Automation occurrences

> As built, the console computes the occurrences from the automations
> list with the same `nextScheduleOccurrence`; there is no endpoint, and
> past runs are not drawn yet (17 "As built"). The design below stands
> for when the month should show what actually ran.

`automations` gains a query, `GET /automations/occurrences?from&to`,
that walks each active schedule trigger with the shared
`nextScheduleOccurrence(rule, after)` (`packages/shared/src/automations/schedule.ts`)
between the two dates, in the trigger's own timezone, and returns
`{ automationId, name, at }`. Past occurrences come from `automation_run`
(`scheduledFor`) so the month shows what actually ran, with its outcome.
GitHub-event triggers have no time and are not on the calendar. The
range is capped (one month and a week each side) so a "hourly" trigger
cannot return thousands of rows; hourly triggers show as one all-day
"Hourly · *name*" item instead.

## 4. Google Calendar: the connection

**Separate from sign-in.** Google sign-in asks for `openid email
profile` with no refresh token, and stays that way: a person who signs
in with Google has not agreed to share their calendar, and a person who
signs in with GitHub may still want it. The calendar is a second,
incremental OAuth grant, started from Plan's sidebar ("Connect Google
Calendar") or Settings → Integrations, with `access_type=offline`,
`prompt=consent`, `include_granted_scopes=true` and
`https://www.googleapis.com/auth/calendar.readonly` (decided, 17).
The same Google client (`GOOGLE_CLIENT_ID`) serves both; the callback is
the API's own (`/v1/calendar/google/callback`), not Better Auth's.
`calendar.readonly` is a "sensitive" scope: Google's verification takes
days and a published privacy policy, and until then the client is
limited to 100 test users, which covers us.

**`calendar_connection`** — the only thing stored for Google.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `organizationId` | uuid | |
| `userId` | uuid | whose Google account this is |
| `provider` | varchar(16) | `google` |
| `accountEmail` | varchar(320) | shown on the sidebar card |
| `refreshTokenSealed` | bytea | encrypted at rest (below) |
| `scopes` | text[] | as granted |
| `status` | varchar(16) | `active` · `revoked` |
| `createdAt`, `updatedAt` | timestamptz | |

Unique `(organizationId, userId, provider)`. The Google layer shows the
viewer's own connection only. The grant belongs to a person, not the
workspace, so a member never reads someone else's Google calendar.

**The refresh token is encrypted at rest** with AES-256-GCM under
`CALENDAR_TOKEN_KEY` (32 bytes, base64, documented in the root
`.env.example`). The ciphertext carries a key-id prefix so the key can
rotate. The helper lives in the `calendar` module's infrastructure, and
moves to a shared package only when a second integration needs one.
Access tokens are minted per request and never stored.

Disconnect revokes the token at Google and deletes the row.

> As built since, a person connects **up to five Google accounts**, keyed by
> Google's `sub`, each with its own colour on the month and its own toggle
> under the Google layer (`23-plan-milestones-stats-accounts.md` §5,
> migration `1791000900000-AddCalendarAccounts`). The one-connection unique
> above, `GET`/`DELETE /calendar/google/connection` and
> `POST …/connection/start` are replaced by `GET`/`POST
> /calendar/google/connections` and `DELETE …/connections/:id`; the
> callback is still `POST /calendar/google/connection`. What follows in §4–5
> is the single-account design as it was decided.

## 5. Reading Google

No events are stored and nothing syncs. The Google layer is a read
through `CalendarProviderPort` (`listEvents(connection, from, to)`,
`revoke(connection)`), implemented by a `GoogleCalendarAdapter`:

- `GET /calendar/google/events?from&to` mints an access token from the
  sealed refresh token and calls `events.list` on the primary calendar
  with `singleEvents=true` and the range, paged. It returns the events
  in the shape the month view draws: title, all-day or start/end, busy,
  a link to the event in Google and, since 2026-10-20, where to join it
  (`meetingUrl`): the event's Meet link, else the video entry point of a
  conference an add-on attached (Zoom, Teams), else a location that is
  itself an address, else a Zoom, Meet, Teams or Webex join link written
  in the location or the description (a pasted invite); only an `https:`
  address, since the console makes it a link.
- The console caches the result per month in the query client. It
  refetches on focus and when the cache is older than a couple of
  minutes. The sidebar card shows the account and "Updated *2 min
  ago*" from that cache.
- If Google answers `invalid_grant`, the connection is marked `revoked`
  and the card says "Reconnect". On any other error the Google layer
  shows as unavailable with Retry, and the rest of the month still
  draws.

The port is the seam: Outlook or iCloud would be a second adapter and a
new `provider` value. Stored events, sync tokens and a sync job come
back only if something needs Google's events when nobody is looking: a
reminder, a conflict check before an automation runs, or write-back.

## 6. Day, Week and To do (2026-11-08)

The 2026-11-08 `Tasks` frame adds Day and Week beside the month, and
Day is where the calendar opens. Built on 2026-11-08 in the console only;
the API is unchanged.

- **The address**: `?view=day|week|month` (Day when absent), `?date=`
  the day Day and Week are on (today when absent), `?month=` the month
  as before. Day / Week / Month sit in the header as a segmented
  control; previous and next step a day, a week or a month. The header
  gains an eyebrow (Today · Week 45, Week 45, Weeks 44–49 over a month)
  and counts only the view's days.
- **The hours**: each day is a column from 07:00 to 22:00 under an All
  day row (`AgendaCalendar` in the design system). A timed event runs
  from its start to its end; a task due at a time stands an hour there,
  and an automation run half an hour; whatever overlaps shares the
  column. Anything that starts before 07:00 or from 22:00 sits in All
  day with its time, so nothing on the day goes undrawn. Today carries a line at the current minute. A day's head, and
  a day's number on the month, opens that day.
- **Moving**: a personal event dropped on a half hour starts there and
  keeps its length (an all-day one becomes an hour), and dropped in All
  day changes day only; a task dropped on a half hour is due then, and
  in All day keeps its day with no time. Google's events and automation
  runs still do not move. Clicking an empty half hour opens New event
  there, half an hour long (`?at=`).

**To do**, Plan's new sidebar view (`/plan/todo`, after Tasks, with the
open tasks due by today as its count), lists one day's tasks as cards:
those due that day (the timed ones first, by time), then, on today or a
later day, the open ones due before today, oldest first, which **Include
overdue** leaves out (`?overdue=off`); a past day lists only its own. It narrows by project like the board (and remembers
it the same way), ticks a task Done or back, opens it on the board, and
adds a task due that day from the dashed row under the list.

> Changed on 2026-11-09, twice. Opening a task from To do now opens its
> dialog on To do (`?task=`), and saving or closing it stays on the day.
> Then the owner asked that To do be what they mean to work on, not what
> is due: "one thing is when is the deadline of the task and another is
> when I am working on it", and some tasks take days. So a task has a
> **focus date** apart from its due date (`task."focusDate"`, a calendar
> day like `dueDate`; the API's create and update take it, `null` takes a
> task off). To do lists, for a day:
>
> 1. the tasks put on that day and those due on it, timed ones first;
> 2. on today or a later day, the open tasks put on an earlier day: they
>    stay until done, which is how work that takes days stays on the list
>    with no range, each saying since when ("on To do since Mon");
> 3. with Include overdue on, the open tasks due before today, as before.
>
> A carried or overdue task ticked done stays on the day it was done, so
> finishing it does not make it vanish; a past day lists its own and what
> was finished on it. The owner chose (2026-11-09) that what is due today
> or overdue is on the list on its own, not only suggested; that unfinished
> work carries over rather than starting each day empty; and that the day
> picker stays, so tomorrow can be planned. The dashed row adds a task put
> on that day with no due date, and **Add tasks** (formerly Add undated
> tasks) puts any open task not on the day there, its due date unchanged.
> The task dialog has a **To do** day above **Due**. The sidebar's count
> is what is left on today's list. Nothing is logged for a focus date:
> planning a day is not a change Plan's log records (`23`, §4). Left for
> later: a way to take a task off today from its row, and the bots' plan
> tools setting a focus date.

A row's grip, six dots at its right end, drags it into the reader's own
order for that day, kept on this device as Plan's sidebar order is (the
frame keeps it in the browser too); a task the stored order does not
name keeps its place after the ones it does.

One departure from the frame, because the API has no field for it: a
task gets no planned slot and length of its own (the frame keeps one
per task in the browser) — its due time is its slot, and an hour its
length. That is open question 4.

## Open questions

1. Which calendars: primary only (as written), or a picker in Settings
   (which adds `calendar.calendarlist.readonly`)?
2. Should a task with a due **time** take a time slot on the calendar,
   or always sit in the day's top band as the frames draw it?
   > Answered on 2026-11-08 (§6): on Day and Week it takes the slot at
   > its due time, an hour long; the month keeps it in the day's list.
3. Does a week view come before or after Google write-back? The frames'
   "n more" overflow on busy days (the 8-item Tuesday) argues for it.
   > Answered on 2026-11-08 (§6): before. Day and Week are built; Google
   > stays read-only.
4. Should a task carry a planned slot and length apart from its due
   date and time, as the 2026-11-08 frame plans one? That is a column
   on `task` and a field on its schema; until then the due time is the
   slot.
5. Should To do's order be the reader's (dragged, per day), and kept
   where: per device, as Plan's sidebar order is, or on the task?
   > Answered on 2026-11-09: the reader's, dragged by a grip at the
   > row's right end, kept per device and per day (§6). On the task
   > would need a field the API does not have.
