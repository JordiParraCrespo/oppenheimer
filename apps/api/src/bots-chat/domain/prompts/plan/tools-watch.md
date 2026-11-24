<!-- What the plan watch tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-plan-watch-tools.factory.ts`, `bot-plan-watch.resolver.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: events-help -->

created (a task was added), status_changed (moved between Not started, In progress and In review), completed (moved to Done), reopened (moved out of Done), blocked, unblocked, deleted, rescheduled (its due date changed), reassigned (moved to another project or milestone), session_linked (a session was attached to it)

<!-- fragment: events -->

The changes that wake you. Default: {{taskWakeDefault}}. One of: {{eventsHelp}}.

<!-- fragment: purpose -->

Why you follow it, in a line; you are reminded of it when it wakes you.

<!-- fragment: watch-project-project-id -->

The project to follow (from list_projects).

<!-- fragment: watch-milestone -->

the tasks under one milestone of a project (list_tasks shows a task's milestone)

<!-- fragment: unwatch-project-project-id -->

A project you follow (from list_watches).

<!-- fragment: unwatch-milestone-milestone-id -->

A milestone you follow (from list_watches).

<!-- fragment: follow -->

You follow the tasks of {{scope}} "{{name}}" ({{id}}) and will be woken on: {{taskEvents}}. End your turn now rather than wait for it.

<!-- fragment: watch-description -->

Subscribes you to {{what}}, so you are woken with a turn of your own when one of them changes the way you name in events: by default when a task is added, moves column, is done or reopened, is blocked or unblocked, or is deleted. No need to poll list_tasks. You are told which task, what changed and whether your person did it, never its notes: read it with get_task. Your own changes never wake you. It lasts until unwatch_{{scope}}; watching it again replaces the events and the purpose. At most {{subscriptionsPerBot}} sessions, pull requests, projects and milestones followed at once.

<!-- fragment: unwatch-description -->

Stops following a {{scope}}'s tasks: they will no longer wake you. The {{scope}} itself is untouched.

<!-- fragment: watch -->

There is no {{scope}} {{id}} you can read: list_projects lists the projects, list_tasks names each task's milestone.

<!-- fragment: assert-room -->

You already follow {{subscriptionsPerBot}} sessions, pull requests, projects and milestones. Unwatch one you no longer need (list_watches shows them) first.
