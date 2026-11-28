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

## Fixed in a later layer

- **A** (P1), on `claude/dazzling-darwin-pbdhdk-github-claim`: a GitHub
  installation could be claimed by anyone with read access to one of its
  repositories, since the claim only checked that `GET /user/installations`
  listed it. The claim now also needs the authorizing account to be the
  installation's personal account, or an active `admin` of its organization
  (`GET /user/memberships/orgs/{org}`, refused on 403 or 404); every path that
  lands a claim goes through it (`github/application/installation-claim.resolver.ts`).
  Shown by handler and adapter tests that fail on the old code. The
  organization check needs the App's **Members: read** organization
  permission; without it every organization connect answers `GITHUB_004`,
  which the GitHub guide page and `.env.example` now say.

- **B and F**, on branch `claude/dazzling-darwin-pbdhdk-memberships`. Better
  Auth's organization writes (`/api/auth/organization/*`: create, update,
  delete, remove-member, update-member-role, leave, invite-member,
  accept/reject/cancel-invitation, create/update/remove-team,
  add/remove-team-member) answer 404 to clients (`disabledPaths`); the
  façade's `auth.api.*` calls are unaffected. Accepting an invitation again
  grants the member's current role, never the invitation's; accepting needs a
  verified email (`requireEmailVerificationOnInvitation: true`); a membership
  that ends stages `MembershipEndedDomainEvent` in the revocation's
  transaction and the api-tokens module revokes the tokens pinned to that
  organization, while the token resolver refuses a pinned token whose owner
  is no longer a member meanwhile. `admin` is Better Auth's built-in admin
  without `set-role`, which stays with `superadmin`. Each has a test that
  fails on the old code. Still open from B: the Inbox routes are `@NoPolicy`
  and trust the tenant alone. Still open next to F: `admin` keeps
  `set-password`, `set-email`, `ban` and `delete` over a `superadmin` (Better
  Auth guards only impersonation of admins), so an admin can still take a
  superadmin's account by resetting its password; the fix is a hook that
  refuses those on a target holding an admin role unless the caller is a
  superadmin.

- **E** (branch `claude/dazzling-darwin-pbdhdk-triggers`): a GitHub event
  starts a run, and wakes a bot or session following a pull request, only
  when the repository's owner, a member or a collaborator caused it
  (`author_association`; a label added by another person, a check on the
  repository's own branch, a push, merge or release). It fails closed on an
  event with no association, and is a fixed rule with no per-trigger
  opt-out (`github/domain/github-event-actor.policy.ts`; handler tests that
  fail on the old code). `design/bots/bot-subscriptions.md`'s 2026-11-03 call, that a stranger's comment
  wakes a watching bot, changed with it.
- **I, routine webhooks unsigned by default** (same branch): a URL asked for
  through the API without `signed` is signed when `BOTS_PROVIDER_KEY` is set;
  stored URLs keep what they had. A valid signature is claimed once in Redis
  for its window, so a replayed signed request is refused `401` whatever
  `Idempotency-Key` it carries. Still open: the console's checkbox starts
  unticked (a visual change, waiting for its screenshots).

On `claude/dazzling-darwin-pbdhdk-hardening`:

- **H (the preview's own cookie).** It is `__Host-oppenheimer_preview`
  (`Secure`, `Path=/`, no `Domain`), so a sibling preview cannot plant one;
  every copy a request carries is tried, and every `Domain` is taken off an
  app's `Set-Cookie`. A test with a planted copy first fails on the old code.
- **I.** nginx logs `$uri`, never the query (the `Referer` cut at `?`), and
  masks the token in the three paths that carry one (`/api/auth/reset-password/`,
  `/api/v1/cloud-files/`, `/api/v1/routine-webhooks/`) as `[redacted]`;
  `CSP_EXTRA_ORIGINS` is split into `CSP_CONNECT_ORIGINS` and
  `CSP_SCRIPT_ORIGINS` (the old one now widens `connect-src` only); a control
  character in a redirect path (`/\t/evil.example`) is refused by
  `safePreviewPath` and `sanitizeRedirect`; the runner refuses a `host.exec`
  `home` that is not one folder name (`EXEC_003`); `release-runner.yml` reads
  its inputs through `env:` and checks them. Each with a test that fails on the
  old code, but the nginx and workflow changes, which were read, not run.
- **Two gaps the autoreview found in fix 2 and fix 6.** A token minted with an
  API token may not outlive it or be accepted from addresses outside its IP
  allowlist (`TOKEN_002`); production refuses `DB_PASSWORD=oppenheimer`, which
  `.env.example` ships and satisfied the prod compose's required variable.

## Open: needs a decision

| # | Severity | What | Proposed fix |
|---|----------|------|--------------|
| C | P1 | **Pre-account squatting.** Sign-up does not need a verified email, and API tokens and OAuth grants survive a password reset. Someone registers `victim@corp.com` first, mints a token, and keeps it after the real owner recovers the account with "Forgot password" and pairs hosts | Require a verified email before minting a token or approving an OAuth grant, and revoke both on password reset |
| D | P1 off Cloudflare | **Better Auth's sign-in rate limit trusts `X-Forwarded-For` as sent.** A deployment not behind Cloudflare gets unlimited password guesses by sending a new header each time; behind Cloudflare, one shared bucket can be held full | Set `advanced.ipAddress` to the same proxy depth as `TRUST_PROXY`, or have nginx overwrite the header |
| G | P2 | Session tokens, OAuth access and refresh tokens, and social-login provider tokens are stored in plain text, so a database dump holds working credentials | Store digests (sessions) and encrypt (`account.encryptOAuthTokens`) |
| H | P2 | All previews share one site, so a malicious dev server in one preview can still set **app** cookies (`Domain=<preview domain>`) for every other preview's app (break it, or fix a session into it). The preview's own cookie can no longer be shadowed (above) | Put the preview domain on the Public Suffix List, or one registrable domain per preview (now in the `/session-previews` skill and `design/sessions/session-previews.md`) |

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
