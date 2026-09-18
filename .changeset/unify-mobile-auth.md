---
"@oppenheimer/design-system-mobile": minor
"@oppenheimer/frontend-mobile": minor
"@oppenheimer/mobile": minor
"@oppenheimer/admin-mobile": minor
"@oppenheimer/mobile-showcase": patch
---

Give the Expo apps the same sign-in screens as the web apps.

`@oppenheimer/frontend-mobile` now owns the shared auth frame, forms, password
controls, social providers, and forgot/reset flows used by both Expo apps.
`@oppenheimer/design-system-mobile` adds the brand mark, and both apps receive the
matching theme tokens, inline translated failures, and terminal success states.
