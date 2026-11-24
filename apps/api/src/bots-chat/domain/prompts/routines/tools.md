<!-- What the routine tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-routine-tools.factory.ts`, `bot-routine-tool.mapper.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: schedule-trigger-frequency -->

once (needs date), hourly (at minute), daily, weekdays, weekly (needs days), monthly (needs day_of_month), cron (needs cron) for what the others cannot say.

<!-- fragment: schedule-trigger-cron -->

Cron only: five fields, minute hour day-of-month month day-of-week (0 = Sunday), in the zone; write it from the person's words. Several times a day: 0 9,13,18 * * *. Every 15 minutes in work hours: */15 9-17 * * 1-5. Last weekday of the month: 0 17 LW * *. Second Tuesday: 0 10 * * 2#2. Last Friday: 0 16 * * 5L. No two firings closer than 5 minutes. Leave hour and minute out.

<!-- fragment: schedule-trigger-timezone -->

An IANA zone; default the sender's.

<!-- fragment: github-trigger-repositories -->

GitHub repository ids (list_repositories).

<!-- fragment: github-trigger-branch -->

Only for this branch; any branch when absent.

<!-- fragment: gmail-trigger-account -->

The Gmail account to watch: its id, address or name.

<!-- fragment: gmail-trigger-query -->

Only mail matching this Gmail search (from:billing@x.com is:important); any new mail when absent.

<!-- fragment: webhook-trigger -->

Runs when something is posted to the routine's webhook URL (a deploy pipeline, Sentry, a form). You never see the URL: the person issues it, and its optional signing secret, on the Routines tab. One per routine. What was posted reaches you as outside data.

<!-- fragment: webhook-trigger-twice -->

A routine has one webhook URL, so at most one webhook trigger.

<!-- fragment: describe-webhook-issued -->

webhook URL issued

<!-- fragment: describe-webhook-not-issued -->

no webhook URL yet: the person issues it on the Routines tab

<!-- fragment: routine-action -->

What to do. Every action but list answers your whole list of routines.

<!-- fragment: routine-routine-id -->

The routine to act on (from list); not for create or list.

<!-- fragment: routine-prompt -->

What you will do each time it runs, written to yourself.

<!-- fragment: routine-triggers -->

When it runs; any one starts a run. Replaces the set on update.

<!-- fragment: routine-enabled -->

Create only: start paused with false. Default true.

<!-- fragment: input-message-create-needs-name -->

create needs a name, a prompt and at least one trigger

<!-- fragment: input-message-action-needs-routine -->

this action needs routine_id

<!-- fragment: update-routine -->

Lists, creates, changes, pauses, resumes, deletes or runs your routines: tasks you run on your own, on a schedule (your heartbeat: "every weekday at 9, check open PRs"), when a GitHub event happens, when new mail reaches one of the person's Gmail accounts (checked about once a minute), or when an outside system posts to its webhook URL (after saving one, tell the person to issue the URL on the Routines tab). list them; create one (a name, a prompt written to yourself, and one or more triggers); update, pause, resume or delete one; or run_now to run one at once. Everything but list and pause asks the person first. When a routine runs, you get a turn opened by it, with nobody writing to you. Use it when the person asks you to do something regularly or when something happens; a one-off task is not a routine.

<!-- fragment: routine-of -->

No routine of yours has the id {{routineId}}. Use update_routine list for their ids.

<!-- fragment: listing -->

You have no routines. Create one when the person asks you to do something regularly.

<!-- fragment: routine-triggers-refusal -->

Trigger {{index}} is not valid ({{value}}). A weekly schedule needs days, a monthly one day_of_month, a once one date (YYYY-MM-DD), a cron one a five-field cron with no two firings closer than 5 minutes; a GitHub trigger needs repository ids; a mail query is at most 500 characters.
