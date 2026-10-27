# apps/extension — agent rules

The Chrome extension that tracks Claude Code cloud sessions. `README.md` says
what it does and how it reads them; these are the rules for changing it.

- **No credential crosses it.** It reads with the browser's own claude.ai
  cookies; it never reads, stores or sends a cookie, a token or the
  `Authorization` header (`cookies` is for `lastActiveOrg`, an id). The
  terms forbid intermediating claude.ai credentials
  (`product/research/cloud-agents.md` §2). What leaves the machine is the
  sessions' ids and states, to the Oppenheimer API the person connected, with
  their own token (`src/sessions/report.ts`); anything more is a product
  decision first.
- **The manifest is a promise.** A new permission or host is a change to
  `manifest.config.ts`, its comment, `src/__tests__/manifest.spec.ts` and the
  README together.
- **`src/sessions/` is plain TypeScript.** No `chrome.*` except `store.ts`,
  no React: it is what the specs test and what a bot will reuse. The state
  rules follow the Claude Code CLI's; change them with a spec that names the
  record that motivated it.
- **Only the worker writes storage.** The popup reads it and asks the worker
  to `refresh`; content scripts only post what the page fetched.
- **The popup is built from `@oppenheimer/design-system-web`**, under
  `.agents/rules/frontend-ui.md`. Effects live in `src/popup/hooks.ts`.
- `tap.ts` runs inside claude.ai's page: it must never throw into it, change
  a request or a response, or import anything heavy.

Check: `pnpm --filter @oppenheimer/extension build && pnpm --filter @oppenheimer/extension test && pnpm --filter @oppenheimer/extension e2e`.
