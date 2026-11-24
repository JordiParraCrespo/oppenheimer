---
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Start session on a task offers any repository the workspace's GitHub
installations reach, not only the project's.

- `@oppenheimer/web`: the repository chip lists the project's repositories
  first (on the base branch the project set), then every other one the
  installations reach (on its default branch), with "Manage repository access"
  at its foot. The form's `repositoryId` becomes `repository`, a
  `repositoryKey`.
- `@oppenheimer/translations`: `tasks.start.noRepositories` no longer sends
  the reader to the project's settings.
