<!-- What the tools tell a model about projects: answers, refusals and the wording of descriptions, from `bot-project.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: namesake-refusal -->

A project named "{{name}}" already exists: {{listed}}. Ask the person whether they mean that one; only if they want a second project with the same name, call again with allow_same_name true.

<!-- fragment: repository-installation-id -->

The installation id list_repositories or get_project shows.

<!-- fragment: repository-github-repo-id -->

GitHub's repository id, from the same.

<!-- fragment: repository-base-branch -->

The branch its sessions start from, usually main.

<!-- fragment: repository-is-default -->

Offered first for a new session; exactly one should be.

<!-- fragment: repositories -->

The project's repositories as a whole set, at most {{maxProjectRepositories}}: one marked is_default when there are any, none twice.

<!-- fragment: allow-same-name -->

Only when the person said they want a second project with a name another already has.

<!-- fragment: create-project -->

Makes a project: a name, optionally the repositories its sessions usually work on (ids from list_repositories) and the host and agent a new session is offered. Answers the new project's id. It refuses a name a project already has, archived ones included, so ask the person which they mean before passing allow_same_name. When the person names a project loosely, call list_projects first; never guess between two.

<!-- fragment: create-project-name -->

What the person calls it, as they wrote it.

<!-- fragment: update-project -->

Changes a project's name, repositories or default host and agent; only the fields you pass change, and null clears a default. repositories replaces the whole set: read get_project first and pass back the ones to keep with their ids. The slug never changes, the Unassigned project keeps its name, an archived project cannot be changed, and sessions already running are not touched. A rename onto another project's name is refused unless allow_same_name.

<!-- fragment: update-project-project-id -->

A project id from list_projects.

<!-- fragment: update-project-message -->

nothing to change: pass at least one field

<!-- fragment: archive-project -->

Archives a project: nothing new can be started or listed in it, its automations are paused, and its tasks and closed sessions stay where they are. restore_project brings it back with its name and slug, but its automations stay paused until the person resumes them. It is refused while the project has sessions that are not closed; move them (move_session) or close them first. Projects are never deleted: archiving is what the console calls deleting. Always asks the person first.

<!-- fragment: archive-project-normalize-unassigned-project-where -->

The Unassigned project is where work with no project goes; it cannot be archived.

<!-- fragment: archive-project-normalize-project-already-archived -->

Project "{{name}}" is already archived.

<!-- fragment: archive-project-normalize-project-still-has -->

Project "{{name}}" still has sessions that are not closed: {{listed}}. Nothing was archived. Ask the person whether to move them to another project (move_session) or close them first.

<!-- fragment: archive-project-summarize -->

Archive the project "{{name}}" ({{slug}}). Nothing new can go in it and its automations are paused; a restore brings it back, but not its automations

<!-- fragment: archive-project-archived-project-tasks -->

Archived project {{id}} "{{name}}". Its tasks and past sessions stay listed under it; list_projects shows it only with include_archived.

<!-- fragment: restore-project -->

Restores an archived project (list_projects with include_archived shows them): work can be started and listed in it again, with its name, slug, repositories, tasks and past sessions as they were. The automations its archive paused stay paused; say so, and point the person at them (list_automations with its project_id). Restoring an active project changes nothing. When the person names an archived project loosely and more than one fits, ask which.

<!-- fragment: restore-project-project-id -->

An archived project id from list_projects with include_archived.

<!-- fragment: restore-project-project-archived-nothing -->

Project {{id}} "{{name}}" is not archived. Nothing changed.

<!-- fragment: restore-project-restored-project-work -->

Restored project {{id}} "{{name}}"; work can be started in it again. The automations its archive paused are still paused.
{{describeProjectInFull}}

<!-- fragment: move-session -->

Moves a session to another project, or to Unassigned when project_id is null. Only the project it is filed under changes: the session keeps its id, history, state, worktree and branch, and a running agent is not interrupted. The move is recorded in the session's log. A closed session cannot be moved, nor one moved into an archived project. When the person names the session or the project loosely, find it with list_sessions or list_projects, and ask if more than one fits.

<!-- fragment: move-session-session-id -->

The session to move (from list_sessions).

<!-- fragment: move-session-project-id -->

The project to list it under (from list_projects); null for Unassigned.

<!-- fragment: move-session-workspace-has-unassigned -->

This workspace has no Unassigned project to move the session to.

<!-- fragment: move-session-project-workspace-list -->

No project {{projectId}} in this workspace. list_projects names the ones there are.

<!-- fragment: move-session-project-archived-so -->

Project "{{name}}" is archived, so nothing new can be listed in it. Nothing was moved; ask the person for another project.

<!-- fragment: move-session-session-already-nothing -->

Session {{id}} "{{name}}" is already in "{{name2}}". Nothing changed.

<!-- fragment: move-session-moved-session-from -->

Moved session {{id}} "{{name}}" from {{fromLabel}} to "{{name2}}" ({{id2}}). It keeps its id, history, state ({{state}}) and worktree; nothing on the host changed.

<!-- fragment: checked -->

{{field}}breaks the rule its description gives

<!-- fragment: checked-refusal -->

Not a project the console would take: {{issues}}.
