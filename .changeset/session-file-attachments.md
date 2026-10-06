---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/runner": minor
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/api-client": patch
"@oppenheimer/translations": patch
---

A session takes files, not only images: PNG, JPEG, GIF and WebP as before,
plus PDF and UTF-8 text (plain, Markdown, CSV, JSON, code, logs), pasted,
dropped or attached to the first task. Every file is judged by its bytes at
the API and again on the host: executables, archives, scripts with a `#!`
line, SVG and HTML are refused whatever they are called, and the runner
names each file itself. A runner announces the wider set with the
`session.files` capability; an older one is still sent images only.
