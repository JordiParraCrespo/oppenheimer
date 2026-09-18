---
"@oppenheimer/web": patch
---

Adopt React Hook Form for the auth forms, validated against the shared Zod
schemas: per-field errors inline, and no submit until the whole form parses.

Because workspace `dist` folders sit outside `node_modules`, `vite.config.ts`
now points the CommonJS interop plugin and `optimizeDeps` at
`@oppenheimer/shared/schemas/auth` — without that, Rollup cannot see the named
exports.
