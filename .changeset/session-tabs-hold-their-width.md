---
"@oppenheimer/design-system-web": patch
"@oppenheimer/web": patch
---

Session tabs are narrower and no longer jump when a session is created.

- `@oppenheimer/design-system-web`: a `ChatTab` is 160px while the strip has
  room (240px before).
- `@oppenheimer/web`: New session keeps the plus's room in the tab strip, so
  the lit New session tab becomes the new session's tab in place and no
  other tab narrows.
