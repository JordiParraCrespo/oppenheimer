# 03 — The calendar

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
| Task due dates | `tasks` (02) | `GET /tasks?dueFrom&dueTo` |
| Automations | `automations` | `GET /automations/occurrences?from&to` (new, §3) |
| Google Calendar | `calendar`, read through to Google | `GET /calendar/google/events?from&to` (§5) |
| Personal | `calendar`, if it survives | `GET /calendar/events?from&to` (§2) |

A layer toggle is a query enabled or not, each read is cached in the
console's query client for the open month, and nothing on the server
joins across modules. Every route here is behind the `plan` flag (02 §8).

## 1. What each item does

- **Event**: time and title; busy events in full colour, free ones
  muted; all-day events as a filled bar. A personal event opens the
  event dialog and drags to another day. A Google event opens read-only
  with "Open in Google Calendar" and does not drag (README, decided 2).
- **Task due**: a check-circle and the title, struck through when Done.
  Click opens the task dialog; drag to another day sets its due date
  (`PATCH /tasks/:id`).
- **Automation run**: a bolt, time and name, muted; click goes to the
  automation. Not draggable.
- **Day cell**: click on empty space opens New event on that day if
  personal events exist, otherwise New task due that day.

## 2. Personal events (an option until README question 1 closes)

If personal events stay, they are the only events Plan stores, in one
table with one shape:

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

If the answer is no, this section, the Personal layer and New event go,
and the `calendar` module holds only the Google connection (§4–5).

## 3. Automation occurrences

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
`https://www.googleapis.com/auth/calendar.readonly` (decided, README).
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

## 5. Reading Google

No events are stored and nothing syncs. The Google layer is a read
through `CalendarProviderPort` (`listEvents(connection, from, to)`,
`revoke(connection)`), implemented by a `GoogleCalendarAdapter`:

- `GET /calendar/google/events?from&to` mints an access token from the
  sealed refresh token and calls `events.list` on the primary calendar
  with `singleEvents=true` and the range, paged. It returns the events
  in the shape the month view draws: title, all-day or start/end, busy,
  and a link to the event in Google.
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

## Open questions

1. Which calendars: primary only (as written), or a picker in Settings
   (which adds `calendar.calendarlist.readonly`)?
2. Should a task with a due **time** take a time slot on the calendar,
   or always sit in the day's top band as the frames draw it?
3. Does a week view come before or after Google write-back? The frames'
   "n more" overflow on busy days (the 8-item Tuesday) argues for it.
