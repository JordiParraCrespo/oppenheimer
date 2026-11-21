<!-- What the automation tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-automation-tools.factory.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: test-results-note -->

A run's status says whether its session finished, not whether tests passed: test results are not known unless the session's result says so (read it with get_session).

<!-- fragment: list-automations -->

Lists the workspace's automations (a saved task a coding agent runs on a schedule, on a GitHub event, or by hand), each with its triggers, whether it is paused or running, and its last run. Filter by project; at most {{automationsLimitMax}} per call. Use get_automation for one automation's settings and prompt, and run_history for its runs.

<!-- fragment: list-automations-project-id -->

Only automations of this project (an id from list_projects).

<!-- fragment: list-none-in-project -->

That project has no automations.

<!-- fragment: list-none-in-workspace -->

The workspace has no automations. The person makes one from Automations in the console.

<!-- fragment: list-automations-hint -->

Filter by project_id, or raise limit.

<!-- fragment: get-automation -->

Reads one automation: its triggers and when each fires next, the host, agent, model and permission its runs use, the repositories it works in, its limits, its prompt, and a digest of its last {{runHistoryDays}} days of runs. Use run_history for the runs themselves.

<!-- fragment: get-automation-automation-id -->

An automation id from list_automations.

<!-- fragment: get-automation-none-runs-checkout -->

none (it runs in no checkout)

<!-- fragment: get-automation-when-another-run -->

- when another run is still live: {{overlap}}

<!-- fragment: get-automation-none-runs-only -->

- none: it runs only when someone runs it by hand

<!-- fragment: run-history -->

Lists automation runs, newest first: each run's cause, status, when it fired, and the session it started. Filter by automation, project, status or window (24h, 7d, 30d); at most {{runsLimitMax}} per call. Runs that never became a session (skipped, expired) are left out unless asked for by status. A run's status is not its test results; read the session with get_session for what the agent reported.

<!-- fragment: run-history-automation-id -->

Only runs of this automation (an id from list_automations).

<!-- fragment: run-history-project-id -->

Only runs of this project's automations.

<!-- fragment: run-history-status -->

Only these statuses. Default: queued, running, completed, failed and cancelled.

<!-- fragment: run-history-window -->

How far back: 24h, 7d or 30d.

<!-- fragment: run-history-runs-last-match -->

No runs in the last {{window}} match. That says nothing ran, not that anything is wrong.

<!-- fragment: run-history-hint -->

Narrow by automation_id, status or window, or raise limit.

<!-- fragment: run-history-window-completed-failed -->

In this window: {{completed}} completed, {{failed}} failed, {{running}} running, of {{all}}.

<!-- fragment: describe-trigger-gmail-mail-received -->

gmail mail_received in account {{connectionId}}{{query}}

<!-- fragment: describe-trigger-webhook -->

something posted to its webhook URL

<!-- fragment: describe-trigger-every-new-message -->

(every new message in the inbox)

<!-- fragment: describe-digest-runs-none-last -->

Runs: none in the last {{runHistoryDays}} days.

<!-- fragment: describe-digest-runs-last-days -->

Runs: {{runCount}} in the last {{runHistoryDays}} days{{running}}. Latest:

<!-- fragment: describe-place-claude-codes-cloud -->

in: Claude Code's cloud, started from host {{hostId}}

<!-- fragment: describe-place-s-cloud-owners -->

in: {{place}}'s cloud, on the owner's key
