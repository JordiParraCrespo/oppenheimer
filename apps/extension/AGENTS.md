# apps/extension — agent rules

The Chrome extension that tracks Claude Code cloud sessions. `README.md` says
what it does and how it reads them; these are the rules for changing it.

- **No credential crosses it.** It reads with the browser's own claude.ai
  cookies; it never reads, stores or sends a cookie, a token or the
  `Authorization` header (`cookies` is for `lastActiveOrg`, an id). The
  terms forbid intermediating claude.ai credentials
  (`product/research/cloud-agents.md` §2). What leaves the machine, to the
  Oppenheimer API the person connected and with their own token, is the
  sessions' ids and states (`src/sessions/report.ts`) and their
  conversations (`src/sessions/chat.ts`, decided with the owner on
  2026-11-27); what comes back is the person's own replies, posted on
  claude.ai as them. Anything more is a product decision first.
- **The manifest is a promise.** A new permission or host is a change to
  `manifest.config.ts`, its comment, `src/__tests__/manifest.spec.ts` and the
  README together.
- **`src/sessions/` is plain TypeScript.** No `chrome.*` except `store.ts`,
  no React: it is what the specs test and what a bot will reuse. The state
  rules follow the Claude Code CLI's; change them with a spec that names the
  record that motivated it.
- **Only the worker writes storage.** The popup reads it and asks the worker
  to `refresh`; content scripts only post what the page fetched, and
  `bridge.ts` makes the one write the worker cannot: a reply's post to
  claude.ai's own API, from the page's origin (`background/claude-tab.ts`).
- **The popup is built from `@oppenheimer/design-system-web`**, under
  `.agents/rules/frontend-ui.md`. Effects live in `src/popup/hooks/`.
- **Every word is in `@oppenheimer/translations`** (`{en,es}/extension.json`):
  the popup through `t()`, the worker's badge and notifications through the
  same translator (`src/i18n/translator.ts`), Chrome's listing through
  `_locales/`, which the build writes from `extension.chrome`. A session's
  reason is stored as a code and worded where it is shown.
- `tap.ts` runs inside claude.ai's page: it must never throw into it, change
  a request or a response, or import anything heavy.
- **A release is a version bump.** Merging a new `version` in `package.json`
  publishes it to the Chrome Web Store (`README.md`, "Publish it"); a change
  people should get bumps it, through a changeset. Nothing else uploads.

Check: `pnpm --filter @oppenheimer/extension build && pnpm --filter @oppenheimer/extension test && pnpm --filter @oppenheimer/extension e2e`.
