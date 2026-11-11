---
"@oppenheimer/web": patch
"@oppenheimer/design-system-web": minor
"@oppenheimer/e2e": patch
---

A hidden session's row shows an eye-off icon instead of the word "Hidden".
The icon keeps "Hidden" as its accessible label.

- `@oppenheimer/design-system-web`: `SessionItem`'s `status` takes a node,
  so a row can carry a labelled icon in the age's place.
- `@oppenheimer/web`: a hidden row's status is the `EyeOff` icon.
