---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

A project may hold no repository. It is a place for tasks, milestones,
memory and sessions before it is a set of repositories, and folder and
terminal sessions need none.

- `@oppenheimer/shared`: `projectRepositoriesSchema` accepts an empty list;
  a default is required only when the project holds a repository.
- `@oppenheimer/api`: the project aggregate and `PROJECTS_006` no longer
  refuse an empty list. The code still names a list with no default, a
  repository twice, more than twenty, or a blank base branch.
- `@oppenheimer/web`: the project dialog saves a named project with no
  repository, and removing the last repository sends an empty list.
- `@oppenheimer/translations`: `errors.byCode.PROJECTS_006` reads the rule
  as it now is.
