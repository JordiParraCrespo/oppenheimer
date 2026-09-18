---
"@oppenheimer/tsconfig": minor
---

`@oppenheimer/config` is now `@oppenheimer/tsconfig`, in `packages/tsconfig/`.
"Config" said nothing — the repo has seven other things that answer to it
(`src/config/` in the API, `ShellConfig`, `vite.config.ts`, the root `.env`) —
while the package holds tsconfig presets and the two build-time helpers that
travel with them (`vite-chunks.mjs`, `depcruise/*.cjs`). Every `extends`,
devDependency, Dockerfile `COPY` and doc reference moved with it; nothing else
changed.
