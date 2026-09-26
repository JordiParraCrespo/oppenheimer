---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": patch
---

Projects become a saved scope a person creates: `POST /projects`, and `PATCH /projects/{id}` now also sets the repositories (replaced as a set, each with a base branch and a default flag), the default host and agent, and instructions. A repository may sit in several projects. A session gains `homeProjectId`, the project whose directory holds its tree, and `POST /sessions/{id}/move` lists it under another project without moving anything on disk (`SESSIONS_018` when the target lacks its repositories). `GET /sessions` gains `githubRepoId`, `agent` and `sort`. New codes `PROJECTS_006` and `PROJECTS_007`.
