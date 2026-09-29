---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/runner": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
"@oppenheimer/web": minor
---

A session's first task can carry images, and New session opens on "Ready when you are."

- `@oppenheimer/shared`: `session.create` carries `images` for runners that name `session.create.images`; `POST /sessions` takes `attachmentIds`.
- `@oppenheimer/api`: `POST /v1/sessions/attachments` stages an image for the create that names it.
- `@oppenheimer/runner`: pulls a create's images and names their paths to the agent with the task.
- `@oppenheimer/frontend-consumer`: `useUploadSessionAttachment`.
- `@oppenheimer/web`, `@oppenheimer/translations`: the paperclip and paste attach images; the subtitle is gone.
