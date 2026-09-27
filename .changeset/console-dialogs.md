---
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
---

New project, Project settings, the console's Add a host and New automation are dialogs over the console again, as the 2026-09-27 design export draws them, and have no address: `/projects/new`, `/projects/$projectId`, `/hosts/new` and `/automations/new` are gone, with the `_editor` layout that framed them. The project dialog takes the name, an "Add a repository…" picker with the chosen repositories as removable rows, and a folding "Defaults · optional" with the default host and agent and which repositories are cloned by default on which base branch; editing adds Delete project. Add a host leads with Copy command and Copy agent prompt, folds the instruction behind "Inspect command and prompt", and Use this host picks the machine on the host chip directly (`?host=` is no longer read). Settings keeps its Add a host page, built from the same kit parts. The design system gains `Disclosure`, `RepositoryDefaultRows` and a `ghost-danger` Button variant, and `RepositoryRowList` becomes the add-and-remove field; the platform kit gains `HostInstallInstruction`.
