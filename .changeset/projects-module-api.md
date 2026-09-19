---
"@oppenheimer/api": minor
---

Add the `projects/` module: the workspace-owned bodies of work sessions belong to, with `GET /v1/projects`, `GET /v1/projects/{id}`, `PATCH /v1/projects/{id}` (name only) and `DELETE /v1/projects/{id}` (archives; never deletes). A project's `slug` is its directory name on every host that holds it, so it is immutable and its row is a permanent tombstone. `ProjectLookupPort.ensureForRepository` resolves — and on a repository's first session creates — a project race-safely, and `ProjectUsagePort` is the seam the module that owns sessions answers before a project can be archived.
