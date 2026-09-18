---
"@oppenheimer/api": minor
---

Entry points (`main.ts`, the TypeORM CLI `data-source.ts`, the seed, OpenAPI
generation, `auth.ts`) import `@oppenheimer/env/load` instead of
`dotenv/config`, which resolved `.env` against `process.cwd()`. The TypeORM CLI
previously loaded no env file at all.
