---
"@oppenheimer/backend-ddd": minor
---

Domain exceptions carry an `httpStatus`, so a `NotFoundException` surfaces as
404 rather than a blanket 500.
