# @oppenheimer/extension

A Manifest V3 Chrome extension that tracks your **Claude Code cloud
sessions** — the ones on claude.ai/code, the ones `claude --cloud` starts,
the ones scheduled tasks start — and tells you which need you.

| Surface | What it does |
| --- | --- |
| **Badge** | How many sessions need you: waiting on a permission or an answer, or failed |
| **Notification** | When a session comes to need you, fails or finishes; a click opens it |
| **Popup** | Needs you, Running, and Done behind a switch. A row opens the session; its terminal button copies `claude --teleport <id>`. Its Oppenheimer section connects the console |

The popup is the console's Inbox (`product/versions/mvp/design/version1/Brain.dc.html`)
cut down to this one job, built from `@oppenheimer/design-system-web`. It
speaks English or Spanish, as Chrome does; the copy is
`@oppenheimer/translations` (`extension.json`).

It has no sign-in of its own and holds no claude.ai credential: it reads
with the claude.ai sign-in already in Chrome, and stores the session list —
plus, once you connect Oppenheimer, the API URL and the token you gave it.

## Run it

```bash
pnpm --filter @oppenheimer/extension build   # or `dev`, to rebuild on save
```

Then `chrome://extensions` → **Developer mode** → **Load unpacked** →
`apps/extension/dist`. Open https://claude.ai/code once while signed in: the
extension watches the page load your session list and learns where it is.
From then on it checks every minute, with or without a claude.ai tab open.

## Connect it to Oppenheimer

Sessions the console starts in Claude Code cloud (New session → Where →
*Claude Code cloud*) have no terminal to watch; their status in the console
is what this extension sees. To send it:

1. In the console, create a personal API token with **`sessions:write`**,
   limited to your workspace (a token not pinned to a workspace has none to
   act in, and the API answers `AUTH_002`).
2. In the popup's **Oppenheimer** section, enter the API's URL and the
   token, then **Connect**. Chrome asks for access to that one host.

From then on, after every check, the worker posts every session it tracks
to `POST /api/v1/sessions/cloud-status` with the token. The API records the
ones your workspace launched and ignores the rest; nothing of claude.ai's
(no cookie, no token) is ever sent.

## How it reads your sessions

There is no public API for a person's cloud sessions
(`product/research/cloud-agents.md` §2), so the extension reads what
claude.ai's own app reads:

- `src/content/tap.ts` runs in claude.ai's page and reads a clone of every
  `GET …/sessions` JSON response, passing on its URL, its `anthropic-*` and
  `x-organization-*` headers, and the body. Never a cookie or `Authorization`.
- `src/background/index.ts` keeps the learned endpoint and asks it every
  minute with the browser's claude.ai cookies. Before it has learned one it
  tries `/v1/code/sessions`, then `/v1/sessions`, on claude.ai.
- `src/sessions/session.ts` turns a session into a state with the rules the
  Claude Code CLI uses for its own cloud session list: a pending action or
  the `blocked` bucket needs you; the `failed` bucket or a failed environment
  failed; `completed` or idle is done.

If claude.ai changes its URL, the tap learns the new one on the next visit.
If it changes the record, `session.ts` and its spec are where to look.

## Commands

```bash
pnpm --filter @oppenheimer/extension test    # Vitest: sessions, tracker, manifest
pnpm --filter @oppenheimer/extension e2e     # Playwright: dist/ in Chromium, claude.ai faked
pnpm --filter @oppenheimer/extension lint
```

`e2e` needs a build first and Playwright's Chromium
(`pnpm --filter @oppenheimer/extension exec playwright install chromium`).
`pnpm ci:local` runs it when the extension changed.

## Layout

```
manifest.config.ts     the manifest as code; each permission and why
popup.html             the popup's page
public/                icons, theme-init.js
scripts/build.mjs      four Vite builds into dist/ (vite.config.ts says why four)
src/
├── sessions/          what a session is and its state, the tracker, storage, links
├── background/        the service worker: poll, badge, notifications
├── content/           tap.ts (in claude.ai's page) and bridge.ts (beside it)
└── popup/             the popup, from the design system
playwright/            the built extension against a fake claude.ai
```

## Not yet

Replying to a session, approving a tool, and the bots. The plan: the
extension stays the bridge — it reads the state and carries it to
Oppenheimer, and later carries replies back — and a bot decides what to say.
