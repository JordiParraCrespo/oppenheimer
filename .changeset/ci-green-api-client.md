---
"@oppenheimer/api-client": patch
---

Let one generator own every DTO name: `src/common/models/*` now re-exports the hey-api type of the same name instead of holding a second, rotting definition of it.
