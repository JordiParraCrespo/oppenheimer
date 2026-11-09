---
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

A project's page under Plan → Projects has a Stats view.

- `@oppenheimer/frontend-consumer`: `TasksRepository.findStats` over
  `GET /plan/stats`, `useSuspensePlanStats`, and the `PlanStats` types.
- `@oppenheimer/web`: an Overview / Stats switch on `/plan/projects/$projectId`
  (`?view=stats`) with a period picker (`?from=&to=`, the last eight weeks by
  default): tasks completed and created with their change against the period
  before and a weekly chart, and tokens per model and agent cost once any
  session reports them.
- `@oppenheimer/translations`: `projects.detail.views`, `overview`, `stats`
  and `projects.stats`.
