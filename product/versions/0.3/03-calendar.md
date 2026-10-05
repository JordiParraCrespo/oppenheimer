# 03 — The calendar

Plan's second section is a month view that shows four **layers**, each
with a toggle in the sidebar: **Google Calendar**, **Personal**, **Task
due dates** and **Automations**. The header counts what the month holds:
*n meetings · n tasks due · n automation runs*. The frames draw a month
grid only (Monday first, today circled, "n more" past four items a day,
compact times under 150 px a column).

Only two of the four layers are calendar data. Task due dates are
tasks (02); automation runs are automations' schedules. So the view is
**composed in the console from three modules**, not served by one:

| Layer | Source | Request |
|-------|--------|---------|
| Google Calendar, Personal | `calendar` module (this note) | `GET /calendar/events?from&to` |
| Task due dates | `tasks` (02) | `GET /tasks?dueFrom&dueTo` |
| Automations | `automations` | `GET /automations/occurrences?from&to` (new) |

Each module stays the owner of its rows, a layer toggle is a query
enabled or not, and nothing on the server joins across modules.

## 1. What each item does

- **Event** (Google or Personal): time and title; busy events in full
  colour, free ones muted; all-day events as a filled bar. Click opens
  the event dialog. Drag to another day moves it.
- **Task due**: a check-circle and the title, struck through when Done.
  Click opens the task dialog; drag to another day sets its due date
  (`PATCH /tasks/:id`).
- **Automation run**: a bolt, time and name, muted; click goes to the
  automation. Not draggable.
- **Day cell**: click on empty space opens New event on that day.

## 2. Personal events

**`calendar_event`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `organizationId`, `userId` | uuid | events are a person's, inside their workspace |
| `source` | varchar(16) | `manual` · `google` |
| `connectionId` | uuid null | FK → `calendar_connection`, `CASCADE`; set for `google` |
| `externalCalendarId`, `externalId` | text null | Google's ids; unique `(connectionId, externalCalendarId, externalId)` |
| `etag` | text null | Google's, for incremental sync |
| `title` | varchar(500) | |
| `notes` | text | |
| `allDay` | boolean | |
| `startsAt`, `endsAt` | timestamptz null | timed events |
| `startDate`, `endDate` | date null | all-day events (end exclusive, as Google) |
| `busy` | boolean | Google's `transparency` |
| `status` | varchar(16) | `confirmed` · `cancelled` (Google deletes arrive as cancelled) |
| `createdAt`, `updatedAt` | timestamptz | |

`CHECK` that exactly one of the timed pair and the all-day pair is set.
Index `(userId, startsAt)` and `(userId, startDate)` for the range query.
Recurring Google events are stored **expanded** (`singleEvents=true`),
one row per occurrence within the sync window; Personal events have no
recurrence in the frames and get none.

The event dialog: title, notes, date, All day, start and end on a
15-minute grid (end shows the duration), Busy / Free, Delete event.
`POST/PATCH/DELETE /calendar/events` for `manual` rows only. Scope
resource `calendar` (`calendar:read`, `calendar:write`).

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
profile` with no refresh token, and should stay that way: a person who
signs in with Google has not agreed to share their calendar, and a
person who signs in with GitHub may still want it. The calendar is a
second, incremental OAuth grant, started from Plan's sidebar ("Connect
Google Calendar") or Settings → Integrations, with
`access_type=offline`, `prompt=consent`,
`include_granted_scopes=true` and the scope below. The same Google
client (`GOOGLE_CLIENT_ID`) serves both; the callback is the API's own
(`/v1/calendar/google/callback`), not Better Auth's.

**Scope.** Proposed: `https://www.googleapis.com/auth/calendar.readonly`
(plus `calendar.calendarlist.readonly` if we let people pick calendars).
Read-only is a "sensitive" scope; Google's app verification takes days
and a published privacy policy, and until then the client is limited to
100 test users, which covers us. Two-way editing needs
`calendar.events` and conflict handling (README open question 2). With
read-only, a Google event's dialog is read-only with "Open in Google
Calendar", and Google events are not draggable — a change from the
frames, which treat them like personal ones.

**`calendar_connection`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `organizationId`, `userId` | uuid | one per user per provider account |
| `provider` | varchar(16) | `google` |
| `accountEmail` | varchar(320) | shown on the sync card |
| `refreshTokenSealed` | bytea | encrypted at rest (below) |
| `scopes` | text[] | as granted |
| `calendars` | jsonb | the calendars synced (default: primary), each with its `syncToken` |
| `status` | varchar(16) | `active` · `revoked` · `error` |
| `lastSyncedAt` | timestamptz null | "Synced 2 min ago" |
| `lastError` | text null | |
| `createdAt`, `updatedAt` | timestamptz | |

Unique `(userId, provider, accountEmail)`.

**Secrets.** Nothing in the API encrypts a stored secret at rest today
(`hosts/infrastructure/seal.util.ts` seals to a host's key, a different
job). The refresh token is the first: AES-256-GCM under a key from a new
`DATA_ENCRYPTION_KEY` (32 bytes, base64) in the root `.env.example`,
with a key id prefix on the ciphertext so the key can rotate. That
helper belongs in `packages/backend/core`, since the next integration
(Slack, 0.4) needs it too. Access tokens are never stored; they are
minted per sync and held in memory.

Disconnect revokes the token at Google and deletes the connection and
its events.

## 5. Sync

- **Window.** 45 days back to 120 days ahead (the frames' seed spans
  −45…+90). Wider is a parameter.
- **First sync** on connect: `events.list` per calendar with
  `singleEvents=true`, `timeMin/timeMax` the window, paged; store the
  final `nextSyncToken`.
- **Incremental**: `events.list?syncToken=…` returns only changes,
  including cancellations; apply by `(externalCalendarId, externalId)`.
  A `410 Gone` means the token expired: full re-sync of that calendar.
- **When.** A BullMQ repeatable job every 5 minutes per active
  connection (the queue module already runs automation schedules), plus
  a sync when the person opens the calendar if the last one is older
  than a minute ("Synced 2 min ago" is honest either way). Google push
  (`events.watch` to a webhook) is the later improvement; it would
  arrive through `inbound-events` like GitHub's webhooks, and needs a
  public HTTPS callback and channel renewal every week.
- **Failure.** `invalid_grant` marks the connection `revoked` and the
  sync card says "Reconnect"; other errors back off and show "Last
  synced *time* · retrying".
- **Window slides** daily: rows older than the window are deleted.

## 6. Where the Google pieces live

A `calendar/` module with a `CalendarProviderPort` (list calendars,
list events since a token, revoke) and a `GoogleCalendarAdapter`, the
same port-and-adapter shape as `github/`. Outlook or iCloud would be a
second adapter and a `provider` value, not a new module.

## Open questions

1. Read-only or two-way (README question 2).
2. Which calendars: primary only (simplest), or a picker in Settings?
3. Should a task with a due **time** be blocked on the calendar as a
   time slot, or always sit in the day's top band as the frames draw it?
4. Does a week view come before or after Google write-back? The frames'
   "n more" overflow on busy days (the 8-item Tuesday) argues for it.
