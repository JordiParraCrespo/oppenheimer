---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/runner": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
"@oppenheimer/web": minor
---

New session opens on "Ready when you are." and its first task can carry images.

- `@oppenheimer/web`: the title is one centred line and the subtitle under it is
  gone. The composer's paperclip attaches PNG, JPEG, GIF or WebP images (up to
  five of 5 MB), and an image pasted into the field is attached too; each is a
  removable chip, and a file the session cannot take is refused with the reason.
  Sending uploads them, then creates the session naming them.
- `@oppenheimer/api`: `POST /v1/sessions/attachments` keeps an image for fifteen
  minutes for its uploader; `POST /v1/sessions` takes `attachmentIds`, refuses a
  host that cannot take them before writing anything (`SESSIONS_016`,
  `SESSIONS_017`) and an id not waiting for the caller (`SESSIONS_019`), and
  parks each for the host's runner to pull.
- `@oppenheimer/shared`: `session.create` carries `images` for runners that
  name the new `session.create.images` capability; `createSessionSchema` takes
  `attachmentIds`; `SESSION_CREATE_MAX_IMAGES`.
- `@oppenheimer/runner`: pulls a create's images before making anything, saves
  them beside pasted ones and appends their paths to the prompt the agent is
  launched with; the stored launch keeps the task as typed.
- `@oppenheimer/frontend-consumer`: `useUploadSessionAttachment` and
  `CreateSessionInput.attachmentIds`.
- `@oppenheimer/translations`: `sessions.new.heading` and the composer's attach
  copy replace the subtitle keys; `errors.SESSIONS_019`.
