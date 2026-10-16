---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/runner": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

A session runs in a new worktree or in a folder already on the host
(`product/versions/mvp/24-session-places.md`).

- `@oppenheimer/runner`: the work folder is `~/oppenheimer/<account>/<workspace>/{repos,
  agents, sessions}`, with bare stores and a `.oppenheimer/` marker in every
  folder the runner makes; a folder session runs in the person's folder and
  writes nothing there; `fs.list` lists a host's directories. The old
  `~/oppenheimer-ai/workspaces` layout is not migrated.
- `@oppenheimer/shared`: `session.create` carries the account and workspace
  ids and either checkouts or a `folder`; `fs.list` / `fs.listing`; the
  `session.folder` and `fs.list` capabilities; `createSessionSchema` takes a
  `folder` instead of checkouts.
- `@oppenheimer/api`: `work_session` records the place and the folder;
  `GET /v1/hosts/{id}/folders` lists a folder through the runner with the
  caller's recent folders; `SESSIONS_025`–`031`.
- `@oppenheimer/web`: New session's Where chip (New worktree, Folder on
  host), the folder picker, Open terminal on a host in Settings, folder and
  terminal icons in the sidebar. The permission level opens on `auto` and is
  remembered.
- `@oppenheimer/design-system-web`: `Composer` takes `allowEmpty`, so a
  blank terminal can start with no first task.
