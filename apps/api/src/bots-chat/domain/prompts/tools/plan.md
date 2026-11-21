<!-- What the plan tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-plan-tools.factory.ts`, `bot-plan-tool.mapper.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: list-projects -->

Lists the workspace's projects with their ids, how many repositories each holds, and the host and agent a new session is offered. Archived projects are left out unless include_archived is true. Use get_project for one project's repositories.

<!-- fragment: list-projects-include-archived -->

Also list retired projects, marked archived.

<!-- fragment: list-projects-there-projects-task -->

There are no projects. A task with no project is filed under Unassigned.

<!-- fragment: get-project -->

Reads one project: its name, its repositories with their base branches (the default marked) and the installation_id and github_repo_id update_project takes back, and the host and agent a new session is offered. Use plan_summary for how its tasks stand, and list_sessions with project_id for the sessions in it.

<!-- fragment: get-project-project-id -->

A project id from list_projects.

<!-- fragment: list-tasks -->

Lists tasks on the plan's board with their column, version, project, milestone, due date, priority and blocked reason, filtered by project, milestone, column or due dates; at most {{tasksLimitMax}} per call. Use get_task for a task's notes and sessions, and plan_summary for progress and what needs the person. No tasks means none match the filters, not that the board is empty.

<!-- fragment: list-tasks-project-id -->

Only tasks of this project (list_projects).

<!-- fragment: list-tasks-milestone-id -->

Only tasks under this milestone.

<!-- fragment: list-tasks-due-from -->

Due on or after this day, YYYY-MM-DD.

<!-- fragment: list-tasks-due-to -->

Due on or before this day, YYYY-MM-DD.

<!-- fragment: list-tasks-hint -->

Narrow by project_id, milestone_id, status or due dates, or raise limit.

<!-- fragment: get-task -->

Reads one task: its title, column, version, project, milestone, due date, priority, blocked reason, notes, and the sessions working on it. Read it again before update_task or move_task when your version may be old.

<!-- fragment: plan-summary -->

Says where each project stands: tasks done of total, what is in progress, what needs the person (blocked, or past its due date in the person's zone), the next task due, and each milestone's progress and target date. Pass project_id for one project. Projects with no task and no milestone are not listed.

<!-- fragment: plan-summary-project-id -->

Only this project (list_projects).

<!-- fragment: plan-summary-project-has-tasks -->

That project has no tasks and no milestones yet.

<!-- fragment: plan-summary-plan-empty-project -->

The plan is empty: no project has a task or a milestone yet.

<!-- fragment: plan-summary-plan-tasks-done -->

Plan: {{done}} of {{total}} tasks done, {{doing}} in progress, {{needsInput}} need the person, {{milestonesCompleted}} of {{milestones}} milestones complete.

<!-- fragment: create-task -->

Adds a task to the plan's board, at the end of its column (Not started unless status says otherwise). A task you make waits in your person's Inbox until they take it up. Without project_id or milestone_id it is filed under Unassigned; a milestone brings its own project. Title up to {{taskTitleMax}} characters, notes up to {{taskNotesMax}}. Use list_tasks first when the task may already exist.

<!-- fragment: create-task-project-id -->

The project to file it under.

<!-- fragment: create-task-milestone-id -->

A milestone of that project.

<!-- fragment: create-task-due-time -->

HH:MM on the due day; needs due_date.

<!-- fragment: update-task -->

Edits a task's title, notes, project, milestone, due date, priority or blocked reason; only the fields you pass change, and null clears one. Use move_task to change its column. blocked_reason (up to {{taskBlockedReasonMax}} characters) marks it as waiting on the person; null unblocks it. Needs the version you read.

<!-- fragment: update-task-project-id -->

File it under this project; a milestone of another project is dropped.

<!-- fragment: update-task-milestone-id -->

A milestone (it moves the task to the milestone's project), or null.

<!-- fragment: update-task-due-date -->

YYYY-MM-DD, or null to clear.

<!-- fragment: update-task-blocked-reason -->

Why it waits on the person, in a sentence; null unblocks it.

<!-- fragment: update-task-message -->

nothing to change: pass at least one field

<!-- fragment: update-task-updated-task-now -->

Updated task {{id}} "{{title}}", now at v{{version}}.
{{describeTaskInFull}}

<!-- fragment: move-task -->

Moves a task to a column (todo, doing, review, done), first in it or directly after another task of that column. Moving to done completes it and clears a blocked reason; moving out of done reopens it. Needs the version you read. Use update_task for anything but the column or the order.

<!-- fragment: move-task-after-task-id -->

Place it directly after this task of the target column; omit or null for first.

<!-- fragment: move-task-moved-task-now -->

Moved task {{id}} "{{title}}" to {{status}} ({{place}}), now at v{{version}}.

<!-- fragment: status -->

The column: todo (Not started), doing (In progress), review (In review) or done.

<!-- fragment: priority -->

How much it matters: urgent (drop other work for it), high, medium or low. Leave it off unless the person said or it is plainly urgent.

<!-- fragment: expected-version -->

The version you last read the task at (list_tasks or get_task shows it as "v<n>"). If someone changed the task since, the write is refused: read it again and decide again.

<!-- fragment: describe-project -->

Unassigned: where work with no project goes

<!-- fragment: describe-project-in-full -->

(Unassigned: where work with no project goes)

<!-- fragment: describe-summary-project-tasks-done -->

Project {{projectId}}{{name}}: {{replace}}, {{done}} of {{total}} tasks done

<!-- fragment: describe-summary-next-due-open -->

- next due: no open task has a due date
