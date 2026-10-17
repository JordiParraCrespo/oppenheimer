---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/web-showcase": patch
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/translations": minor
---

Sharing a session follows the `ShareSession` design
(`product/versions/mvp/21-session-share-links.md`): one share per session
at one address, `/s/<slug>`, for named people or anyone signed in; view, or
write for named people for 24 hours at most. The Share dialog opens from a
row's menu and the terminal's status line, and the guest page is one bar
and the terminal. The share-link routes are replaced by
`GET`/`PUT`/`DELETE /v1/sessions/{id}/share` and
`PATCH /v1/sessions/{id}/share/people`; existing links are dropped. The
design system gains `RadioGroupCard` (with `columns` on `RadioGroup`) and an
`actions` slot on `SessionPaneHeader`.
