<!-- What the routine tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-routine-tools.factory.ts`, `bot-routine-tool.mapper.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: schedule-trigger-frequency -->

once (needs date), hourly (at minute), daily, weekdays, weekly (needs days), monthly (needs day_of_month).

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

Lists, creates, changes, pauses, resumes, deletes or runs your routines: tasks you run on your own, on a schedule (your heartbeat: "every weekday at 9, check open PRs"), when a GitHub event happens, or when new mail reaches one of the person's Gmail accounts (checked about once a minute). list them; create one (a name, a prompt written to yourself, and one or more triggers); update, pause, resume or delete one; or run_now to run one at once. Everything but list and pause asks the person first. When a routine runs, you get a turn opened by it, with nobody writing to you. Use it when the person asks you to do something regularly or when something happens; a one-off task is not a routine.

<!-- fragment: routine-of -->

No routine of yours has the id {{routineId}}. Use update_routine list for their ids.

<!-- fragment: listing -->

You have no routines. Create one when the person asks you to do something regularly.

<!-- fragment: routine-triggers-refusal -->

Trigger {{index}} is not valid ({{value}}). A weekly schedule needs days, a monthly one day_of_month, a once one date (YYYY-MM-DD); a GitHub trigger needs repository ids; a mail query is at most 500 characters.
