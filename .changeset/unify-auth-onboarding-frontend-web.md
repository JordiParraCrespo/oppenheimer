---
"@oppenheimer/frontend-web": minor
---

`AuthLayout` drops its `legal` prop: whether the legal one-liner sits under the
column is now route `staticData` (`authLegal`), read off the innermost match
like `authWidth` and `legalNoteKey`. The layout also no longer assumes the
guard is its own — an app may mount it over subtrees with opposite guards.
