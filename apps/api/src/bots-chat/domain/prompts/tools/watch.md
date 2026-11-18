<!-- What the watch tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-session-watch.resolver.ts`, `bot-watch-tools.factory.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: handed-off -->

You are subscribed to it and will be woken when the task needs input or ends, if it has not got going in a few minutes, and every few minutes while it runs so you can look at how it is going: end your turn now, and report when you are.

<!-- fragment: not-followed -->

You are not watching it; read how it goes with get_session or read_session.

<!-- fragment: follow -->

It could not be watched ({{reason}}); read it later with get_session.

<!-- fragment: store-session-closed-there -->

Session {{sessionId}} is closed: there is nothing left to follow.

<!-- fragment: store-already-follow-sessions -->

You already follow {{subscriptionsPerBot}} sessions and pull requests. Unwatch one you no longer need (list_watches shows them) first.

<!-- fragment: watch-terminal -->

Only a session has a terminal to watch.

<!-- fragment: watch-session -->

Subscribes you to a session, so you are woken with a turn of your own when its task needs input, finishes, fails or is stopped: no need to check on it or to be asked. While the task you follow runs you are also woken every few minutes for a look at how it is going, and check_in_minutes adds a look at a time you choose. Sessions you start with start_session, prompt with send_to_session or unblock with answer_session are watched already. until "task" (the default) follows the task running now, or the next one if none is; "closed" follows every task until the session is closed. With pattern (a regular expression, matched line by line), you are also woken when its terminal prints a new line matching it, such as "FAIL|Error" or "Tests: \d+ passed": you are told it matched and how often, never the line, so read the session to see why. At most {{subscriptionWakeLimit}} wakes per watch, matches included, and {{subscriptionsPerBot}} watched sessions and pull requests.

<!-- fragment: watch-session-session-id -->

The session to follow (from list_sessions).

<!-- fragment: watch-session-until -->

"task" (default): its current or next task; "closed": every task.

<!-- fragment: watch-session-purpose -->

Why you follow it, in a line; you are reminded of it when it wakes you.

<!-- fragment: watch-session-pattern -->

A regular expression (RE2: no lookaround or backreferences) to be woken by when a new line of the terminal matches it.

<!-- fragment: watch-session-check-in-minutes -->

Also look at its running task once, this many minutes from now, even if nothing has happened: for when you told the person you would check back at a time.

<!-- fragment: unwatch-session -->

Stops following a session: it will no longer wake you. The session itself keeps running.

<!-- fragment: unwatch-session-session-id -->

A session you watch (from list_watches).

<!-- fragment: unwatch-session-longer-follow-session -->

You no longer follow session {{sessionId}}.

<!-- fragment: unwatch-session-were-following-session -->

You were not following session {{sessionId}}.

<!-- fragment: list-watches -->

Lists the sessions, pull requests, projects and milestones you follow: each one, why, until when or on which changes, and how many times it woke you. Read a session itself with get_session, a pull request with get_pull_request, a task with get_task.

<!-- fragment: list-watches-follow-sessions-pull -->

You follow no sessions, pull requests, projects or milestones.

<!-- fragment: wait-for-session -->

Waits inside this turn, up to {{sessionWaitMaxSeconds}} seconds, until a session's current task needs input, finishes, fails or is stopped, or the session is closed; answers at once if it already has. Use it for a short task you want to report on in this reply; for anything longer, watch_session wakes you when it ends. At most {{sessionWaitsPerTurn}} waits a turn, and the turn's own 4-minute limit counts: never wait on work you cannot report before it.

<!-- fragment: wait-for-session-session-id -->

The session to wait on (from list_sessions).

<!-- fragment: wait-for-session-have-waited-times -->

You have waited {{sessionWaitsPerTurn}} times this turn. Watch the session with watch_session and end your turn; it wakes you when the task ends.
