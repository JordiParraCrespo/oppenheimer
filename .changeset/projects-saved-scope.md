---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": patch
---

Projects are a saved scope a person creates, and metadata only. `POST /projects` takes a name, the repositories (replaced as a set on `PATCH`, each with a base branch and a default flag), a default host and agent, and instructions. Every session names its project (`projectId` is required on `POST /sessions`; nothing is auto-created), and `POST /sessions/{id}/move` lists it under another project without anything moving on the host: the layout has no project level and a session's branch is `oppenheimer/<session>`. `session.create` no longer carries `projectSlug`. `GET /sessions` gains `githubRepoId`, `agent` and `sort`. The console's New session gains a project chip with a New project dialog, and each sidebar row a Move to project menu. New codes `PROJECTS_006` and `PROJECTS_007`; `PROJECTS_004` is no longer raised.
