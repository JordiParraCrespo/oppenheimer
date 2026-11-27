# Security review, before real users (2026-11-27)

A read of the whole system for two questions: can someone reach another
person's runner, and can someone reach another person's resources. Five
reviewers each took one surface (runner and relay, cross-workspace access in
the API, accounts and credentials, inbound integrations and outbound
fetches, the console and the deployment). Every finding below was then
checked against the code. **Reproduced** means it was run on the local stack
or in a test that fails on the old code; **read** means the code path was
followed end to end without running it.

No review proves a system unbreakable. This one says which paths were looked
at, what was wrong on them, and what is still open.

## Fixed in this pull request

| # | Severity | What | How it was shown | Fix |
|---|----------|------|------------------|-----|
| 1 | P1 | A workspace owner could add **any account** to their workspace with no consent, as `owner` (`POST /v1/organizations/:orgId/members`). The answer showed the victim's email. On the victim's next sign-in they would land in the attacker's workspace, and sessions they started there would run on their own machine under the attacker's control | Reproduced on the stack: two accounts, one added the other | The route now needs a platform administrator (`manage all`); people join by accepting an invitation |
| 2 | P1 | A token holding `tokens:write` could mint a token with **all its owner's reach**, and without its workspace pin. A leaked narrow token, or an OAuth or MCP grant, was a full-account key | A handler test that fails on the old code; then on the stack, a `tokens:write`-only token asking for `hosts:write` | A token minted with a token is held to that token's scopes and organizations (`api-tokens/domain/minting-reach.policy.ts`) |
| 3 | P2 (borderline P1) | A **preview ticket opened the full terminal**. Preview tickets travel in a URL (the preview origin's enter link), so any log that saw the URL inside its 60 seconds held a shell | A relay test with real sockets that fails on the old code | The attach socket refuses any ticket that is not a terminal or device ticket |
| 4 | P2 | Any session could **hide itself from Active sessions** with one `POST /api/auth/update-session {"delegated":true}`, so a stolen cookie could not be found and revoked by id | Reproduced on the stack; an integration test that fails on the old code | `delegated` and `delegatedCredentialId` are no longer client input |
| 5 | P1 if copied | Production booted on the placeholder `BETTER_AUTH_SECRET` in `.env.example`. Whoever knows the secret can forge session and preview cookies | A config test that fails on the old code | In production the API refuses a secret under 32 characters or containing `change-me` |
| 6 | P2 | `docker/docker-compose.prod.yml` published the API on every interface (past nginx and, through Docker's own rules, past ufw) and fell back to the password `oppenheimer`; the dev compose exposed Postgres (known password) and Redis (none) on every interface | Read | Prod: no published API port, `DB_PASSWORD` required. Dev: both bound to `127.0.0.1` |

## Open: needs a decision

| # | Severity | What | Proposed fix |
|---|----------|------|--------------|
| A | P1 | **A GitHub installation can be claimed by anyone with read access to one of its repositories.** The claim only checks that GitHub lists the installation for the authorizing person (`GET /user/installations`), which GitHub does for any collaborator. The attacker's workspace then mints write tokens for every repository the installation covers, receives its webhooks, and the real owner's connect fails with "already connected" (`github/commands/connect-installation/connect-installation.command-handler.ts`) | Require that the authorizing person is the installation's account (a personal one) or an active admin of its organization (`GET /user/memberships/orgs/{org}`). The organization check needs the GitHub App's **Members: read** organization permission, which only the App's owner can grant; without it every organization connect would be refused |
| B | P1 | **Invitations and multi-member workspaces work through the API** although the console has none. That opens: a demoted admin who re-accepts their old invitation gets the `owner` role back (`accept-invitation.command-handler.ts`); Better Auth's own `/api/auth/organization/*` routes remove or demote members without touching their application role, so they keep access; a removed member keeps org-pinned API tokens; the Inbox routes are `@NoPolicy` and trust the tenant alone; an invitation can be accepted without a verified email | Turn invitations and Better Auth's organization write routes off on the server (`disabledPaths`) until the teams slice, as `versions/mvp/08-auth.md` already says of the console |
| C | P1 | **Pre-account squatting.** Sign-up does not need a verified email, and API tokens and OAuth grants survive a password reset. Someone registers `victim@corp.com` first, mints a token, and keeps it after the real owner recovers the account with "Forgot password" and pairs hosts | Require a verified email before minting a token or approving an OAuth grant, and revoke both on password reset |
| D | P1 off Cloudflare | **Better Auth's sign-in rate limit trusts `X-Forwarded-For` as sent.** A deployment not behind Cloudflare gets unlimited password guesses by sending a new header each time; behind Cloudflare, one shared bucket can be held full | Set `advanced.ipAddress` to the same proxy depth as `TRUST_PROXY`, or have nginx overwrite the header |
| E | P2 | A GitHub-triggered routine fires on events from **anyone** on a public repository (an issue, a comment), so a stranger can launch an agent session on the owner's host with text they wrote (wrapped as untrusted) | An "insiders only" filter on triggers, on by default for public repositories |
| F | P2 | The `admin` platform role can promote itself to `superadmin` (`set-role`) | Leave `set-role` to `superadmin` |
| G | P2 | Session tokens, OAuth access and refresh tokens, and social-login provider tokens are stored in plain text, so a database dump holds working credentials | Store digests (sessions) and encrypt (`account.encryptOAuthTokens`) |
| H | P2 | All previews share one site, so a malicious dev server in one preview can set cookies for every other preview (break them, or fix a session into a dev app) | Put the preview domain on the Public Suffix List, or one registrable domain per preview |
| I | P3 | Smaller: nginx access logs keep query strings (single-use tokens reach Loki); `CSP_EXTRA_ORIGINS` also widens `script-src`; a tab in a redirect path passes the open-redirect check; routine webhooks are unsigned by default; the runner joins `host.exec`'s `home` without a check (not reachable today); `release-runner.yml` puts inputs straight into `run:` | Each is a small change |

## Checked and found sound

- **Pairing a runner.** 256-bit tokens, stored as a digest, an hour long,
  single use in one conditional `UPDATE`; the host's owner comes from the
  token row, never the request. The runner's key is Ed25519, kept `0600`.
- **The runner's link.** A signed assertion per dial (issuer, audience,
  five minutes, a `jti` burned in Redis); the owner's standing checked on
  every dial; the host id fixed per socket, and every frame routed through
  it, so a runner cannot read or write another host's sessions. Unpairing
  closes the live link at once.
- **The runner on its host.** No TCP listener, only a `0600` Unix socket in a
  `0700` directory checked for owner and symlinks, so other local users and
  web pages cannot reach it. Updates are Ed25519-signed with keys compiled in,
  checked by hash and size, never downgraded. Names from the API are checked
  against allowlists.
- **Terminal, desktop and share tickets.** 32 random bytes, single use,
  60 seconds, bound to the person, the workspace and the session or host,
  judged again every minute; WebSocket upgrades refuse other origins.
- **Workspace isolation.** Rows are queried with the workspace in the
  `WHERE` clause, nested resources by their parent, the live event stream by
  the caller's workspace. No "load by id, forget the workspace" route was
  found in a sweep of every controller with a path parameter.
- **Inbound integrations.** GitHub and Slack signatures over the raw bytes,
  constant-time, failing closed without a secret; Telegram and WhatsApp reach
  the API only through the owner's own runner link; link codes are random,
  short-lived and single use; OAuth `state` is single use and bound to the
  person and workspace.
- **Outbound fetches.** The bots' web fetch resolves, checks every address is
  public, pins the connection and checks each redirect; no base URL a user
  can set reaches a fetch.
- **The console.** Markdown drops raw HTML and non-http links; maths and
  diagrams run in their safe modes; agent HTML and previews are on other
  origins in sandboxed frames; the CSP has no `unsafe-inline` script; no
  credential is kept in `localStorage`.
- **The deployment** (`deploy/dev`). Nothing published but the tunnel;
  Postgres and Redis on internal networks with secrets in files; Grafana only
  over SSH. GitHub Actions take no pull-request triggers, so forks never get
  secrets. No real secret is committed.

## Not covered

Cloud agents, voice and calendar handlers were swept by script but not read
handler by handler; about 280 controllers were checked by the automated sweep
rather than one by one. Nothing was tested against a real GitHub, Slack or
Google; their behaviour is taken from their documentation. There was no
penetration test of a deployed instance.
