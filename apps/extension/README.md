# @oppenheimer/extension

A Manifest V3 Chrome extension that tracks your **Claude Code cloud
sessions** — the ones on claude.ai/code, the ones `claude --cloud` starts,
the ones scheduled tasks start — and tells you which need you. Connected to
Oppenheimer, it does the same for the sessions on your own hosts.

| Surface | What it does |
| --- | --- |
| **Badge** | How many sessions need you: waiting on a permission or an answer, or failed; with Oppenheimer connected, the ones on your hosts too |
| **Notification** | When a session comes to need you, fails or finishes; a click opens it. With Oppenheimer connected, also when a session on your hosts comes to wait on you or its agent sends a notice; a click opens it in the console |
| **Popup** | Needs you, Running, and Done behind a switch. A row opens the session; its terminal button copies `claude --teleport <id>`. Its Oppenheimer section connects the console |

The popup is the console's Inbox (`product/mockups/version1/Brain.dc.html`)
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
   and **`cloud-chat:write`** too for the chat (below),
   limited to your workspace (a token not pinned to a workspace has none to
   act in, and the API answers `AUTH_002`).
2. In the popup's **Oppenheimer** section, enter the API's URL and the
   token, then **Connect**. Chrome asks for access to that one host. The
   console's URL is optional: it is where a notification about a session on
   your hosts opens, and left empty it is worked out from the API's
   (`localhost:3001` → `localhost:3000`, `api.<domain>` → `app.<domain>`).

From then on, after every check, the worker posts every session it tracks
to `POST /api/v1/sessions/cloud-status` with the token. The API records the
ones your workspace launched and ignores the rest. No claude.ai credential
(no cookie, no token) is ever sent.

### The chat, both ways

Connected, the worker also carries each cloud session's conversation to the
console and your replies back (`src/sessions/chat.ts`), so a session started
on claude.ai, the phone or `claude --cloud` reads in the console the way it
reads in the Claude apps, your messages included:

- **Out.** It reads the session's event log from claude.ai, the log the apps
  draw, with the claude.ai sign-in in Chrome: the route claude.ai's own page
  read it from when the tap has seen one, else
  `/v1/code/sessions/{id}/teleport-events` and `/v1/sessions/{id}/events`,
  the routes the Claude Code CLI reads it from. Each event is the transcript
  entry claude.ai keeps; the worker sends the ones the console does not have
  to `POST /api/v1/sessions/cloud-events`, which adopts a session the
  workspace did not start (in its unassigned project) and replaces the
  transcript the session's hook sent. Read on each pass: the sessions running
  or waiting on you, one you just replied to, and once each, the ones active
  in the last day. Older ones are left alone until they move.
- **In.** A loop claims your replies from
  `POST /api/v1/sessions/cloud-replies/claim`, waiting up to ten seconds for
  one, and posts each to the session on claude.ai as your message
  (`POST /v1/sessions/{id}/events`, a `user` event, the call
  `claude --cloud` makes). The session runs it at once, mid-turn too. One
  claude.ai refuses is handed back (`…/cloud-replies/{id}/release`) for the
  session's Stop hook, and one it took is confirmed (`…/{id}/delivered`).
  An unconfirmed claim lapses after a minute, so a reply whose post never
  happened (a lost answer, a worker Chrome stopped) waits again instead of
  being lost.
- **The token.** The chat's routes ask for `cloud-chat:write` beside
  `sessions:write`: a token that only manages sessions (an `opp` or MCP one)
  can neither read nor take the replies you type. Without it the extension
  still reports states; the chat says why it stopped in its stored
  `chatProblem`. The loop runs while the worker does: each open request
  keeps it alive, and the minute's alarm or **Check now** starts it again.

After the report it reads `GET /api/v1/sessions?resolved=false` with the same
token (`sessions:write` includes `sessions:read`) and tells you, once each,
what the console's Inbox would list from it: a session waiting on you (its
agent asks a question or a permission, or it failed) and a notice its agent
sent, keyed as the Inbox keys them (`src/sessions/runner.ts`). The first read
after connecting only remembers what is already waiting. A cloud run that
Oppenheimer launched is left to the claude.ai tracking above, so it is told
once. Nothing new leaves the machine: this is a read of your own API.

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

## Publish it

The extension is an unlisted item on the Chrome Web Store: only people with
its link find it, and Chrome keeps every install on the latest approved
version by itself. Its privacy policy is the console's
`/privacy#extension`.

**A new version** is a bump of `version` in this `package.json`, by hand or
through a changeset, merged to `main`. `.github/workflows/release-extension.yml`
then builds and tests the extension, zips `dist/`
(`pnpm --filter @oppenheimer/extension package`, into `release/`), uploads
the zip and submits it for review (`scripts/publish.mjs`, the Web Store API
v2), and tags `extension-v<version>` with the zip attached. A version with
a tag is never sent again. Review takes from hours to a few days; installs
update within hours of approval. The store refuses a version that is not
higher than the last one.

**Once, before the first release:**

1. Register a Chrome Web Store developer account (a one-time fee, and
   2-step verification on the Google account) at
   https://chrome.google.com/webstore/devconsole.
2. Build and package this version, then in the dashboard **New item** →
   upload `release/oppenheimer-extension-<version>.zip`. Fill in the
   listing (Chrome's own strings are already in the package's
   `_locales/`), set **Visibility** to *Unlisted*, give the privacy policy
   URL `https://<console>/privacy#extension`, and on **Privacy practices**
   state the single purpose and why each permission is needed, from the
   comment in `manifest.config.ts`. Submit it. The API cannot create an
   item; every later version goes through it.
3. In Google Cloud, enable the **Chrome Web Store API**, create an OAuth
   client (Web application, redirect URI
   `https://developers.google.com/oauthplayground`), and in the OAuth
   Playground authorize scope `https://www.googleapis.com/auth/chromewebstore`
   with that client to get a refresh token. On the OAuth consent screen, set
   the publishing status to **In production**: Google expires a refresh
   token from an app left in *Testing* after seven days, and every release
   after that fails at the token step with `invalid_grant`.
4. In the repository's Actions settings, add the secrets
   `CWS_PUBLISHER_ID` and `CWS_EXTENSION_ID` (both in the dashboard's
   URLs and **Account** page), `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`,
   `CWS_REFRESH_TOKEN`, and the variable `EXTENSION_PUBLISH_ENABLED=true`.
   Tag the version you uploaded by hand (`extension-v<version>`) so the
   workflow does not send it again.

## Commands

```bash
pnpm --filter @oppenheimer/extension test    # Vitest: sessions, tracker, manifest
pnpm --filter @oppenheimer/extension e2e     # Playwright: dist/ in Chromium, claude.ai faked
pnpm --filter @oppenheimer/extension lint
pnpm --filter @oppenheimer/extension package # dist/ → release/oppenheimer-extension-<version>.zip
```

`e2e` needs a build first and a Chromium: the one `PLAYWRIGHT_CHROMIUM_PATH`
names, else the machine's own at `/opt/pw-browsers/chromium` (a cloud
sandbox ships one), else Playwright's
(`pnpm --filter @oppenheimer/extension exec playwright install chromium`).
`scripts/chromium.mjs` resolves it, for every Playwright run in the repo.
`pnpm ci:local` runs it when the extension changed.

## Layout

```
manifest.config.ts     the manifest as code; each permission and why
popup.html             the popup's page
public/                icons, theme-init.js
scripts/build.mjs      four Vite builds into dist/ (vite.config.ts says why four)
scripts/package.mjs    dist/ zipped for the Web Store
scripts/publish.mjs    upload and submit a zip to the store item
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
