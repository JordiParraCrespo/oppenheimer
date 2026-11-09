---
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

Plan's Projects follows the 2026-11-08 `Tasks` artboards: projects are
cards, and a card opens the project's own page.

- `@oppenheimer/design-system-web`: `ProjectCard`, `ProjectCardGrid` and
  `ProjectCardSkeleton`; `ProjectOverview`, `ProjectOverviewColumn`,
  `ProjectPanel`, `ProjectPanelEmpty`, `ProjectMilestoneRow`,
  `ProjectTaskRow` and `ProjectOverviewSkeleton`.
- `@oppenheimer/web`: `/plan/projects` draws a card per project (its
  repositories, and Needs input, Running or Idle from its sessions);
  `/plan/projects/$projectId` is the project's page, with a way back to the
  cards, its settings, its milestones, the tasks that wait on a person and
  the ones in progress.
- `@oppenheimer/translations`: `projects.list.status` and `projects.detail`;
  `projects.list.edit` and `projects.list.repositories` are gone.
