---
"@oppenheimer/frontend-core": minor
---

`UsersRepository.findAll` / `UsersService.findAll` widen their `role` filter
from `'admin' | 'user'` to `Role`, matching the database-backed roles the API
actually accepts.
