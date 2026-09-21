---
"@oppenheimer/frontend-web": minor
---

`AuthLayout` drops its `legal` prop. How a page is framed is now route
`staticData` the layout reads off the innermost match: `authWidth` for the
column, and `legalNoteKey` for the line under it — absent for the default
terms-and-privacy line, a key for a page's own, `null` for none. The
`declare module` block that types them moves into the component, so there is
no side-effect import to remember.
