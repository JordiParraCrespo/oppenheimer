# 08 — Auth in the MVP

One page on who can do what, so nobody has to read the starter's
authorization kernel design (`AUTHORIZATION.md` in the repo root, kept as
history) to work on the MVP.

## Decided

- **Identity** is Better Auth from the starter: GitHub, Google, and
  email plus password, account linking, cookie sessions. Sign-in and
  Connect GitHub are two different things (00-scope.md, note 09).
- **A personal workspace per account.** Sign-up creates one
  `organization` row with the account as its single `owner` member and
  the org-scoped `owner` application role that opens it
  (`apps/api/src/organizations/commands/provision-personal-workspace/`). One user per workspace.
  Onboarding step 2 **names** that workspace and gives it its permanent
  address (the slug under `oppenheimer.dev/`, checked for availability
  as you type); the name can change later, the address cannot
  (05 §onboarding, decided 2026-09-19).
  No roster UI, no invitations, no teams in the MVP; the routes the
  starter ships for them stay unexposed in the console and come back
  with the teams slice on the same tables.
- **Sign-up opens the first-run flow, not the console.** Registering —
  by email or through a provider — lands on `/onboarding/workspace`,
  because the hook can provision a workspace but cannot name it. The
  gate off that step is whether the **address has been claimed**, not
  whether a workspace exists: every account has one from the moment it
  signs up, so presence would send everybody straight past the step
  they were sent to. A workspace whose slug is still the provisional
  one the hook minted (the account's name plus eight hex characters)
  has not been named; one whose slug a person chose is finished, and
  `/onboarding/workspace` returns it to `/sessions`. Signing *in* never
  enters the flow. (Decided 2026-09-21; the flow previously ended at
  sign-up and the four steps were unreachable.)
- **The flow is walked once, and Ready is what says so.** The claimed
  address finishes the *account*, and two steps still run after it, so
  it cannot also be the test for the rest of the flow — every
  legitimate arrival at the landing is finished too. What the landing
  asks is whether this navigation is the walk: step 2's claim opens
  one, the flow's own links carry it, and `/onboarding/ready` reached
  any other way — Back out of the console, a typed address, a second
  tab — returns the reader to `/sessions` instead of congratulating
  them again. Add host asks the same question, for the same reason: the
  console pairs a machine in its own dialog now, so nothing links at
  step 4 and it is first-run's alone. Connect GitHub is the one step
  that is not gated and is not meant to be — New session's repository
  chip still sends a finished account there to install the App, and
  version 1 draws no other screen that does (05). A reader the console
  sent there is not walking, so continuing lands them back in the
  console rather than in the rest of the flow. (Decided 2026-09-22;
  before it, only step 2 was gated and the landing could be re-opened by
  pressing Back.)
- **The console creates exactly one organization: your own.** Sign-up's
  hook is best-effort, so `/onboarding` is the recovery path for an
  account that ended up with no workspace — it creates one and makes the
  caller its owner. It is not organization management: there is no
  roster, no invitation, no second workspace, and an account that
  already has one is sent back to `/sessions`. An account with none
  cannot reach the product shell at all, so creating it is the only way
  forward from that screen besides signing out.
- **Provisioning is gated on membership, not on ownership.** An account
  that already belongs to *any* organization is left alone. With no
  invitations in the MVP that is the same rule as "already has a
  personal workspace"; the two come apart the day an invitation can
  place an account somewhere before it owns anything, and the teams
  slice decides then whether an invitee also gets one of their own.
- **Hosts belong to a person; workspaces borrow them.** A host row
  carries `ownerUserId` and no workspace id, the way Better Auth hangs
  `session` and `account` off `user`: a laptop is a device of the
  person's. `HostResource` declares only `'own'` and `'grant'`, so the
  kernel scopes hosts own-or-grant with no tenant block
  (`applyAccessScope` skips it when the resource has no organization
  key), and sharing one with a teammate is an `access_grant` it already
  supports. The reasons are physical: a session on a direct-mode host has
  full access to that machine (F10), runs under its owner's Unix account,
  and spends the agent login that is "the host's own"
  (00-scope.md) — that person's subscription, which is why host and login
  sit on one axis. A person with a personal and a company workspace pairs
  one laptop once, and either workspace runs sessions on it; the on-disk
  layout keeps the two apart under a per-workspace directory. The pairing
  token is minted by a signed-in user, and the host it creates is theirs;
  the runner's public key is a column on the host row rather than a table
  of its own, and the retired key joins it as a second column when
  rotation arrives on the link (09 §3) — rotation needs exactly two keys,
  never N, and every runner boot reads them.
- **Sessions belong to a workspace, and run on a host their creator may
  use.** `POST /sessions` loads the host through the own-or-grant scope
  and refuses otherwise. Attaching to a session needs a session in the
  caller's workspace plus a short-lived attach ticket minted by the
  control plane (01-protocol.md). The relay checks the ticket, never the
  browser cookie, on the socket.
- **GitHub access is per session.** The control plane mints a one-hour
  installation token narrowed to the session's repository and hands it
  to the runner over the relay; nothing lands on disk (00-scope.md).
- **Scopes and API tokens** from the starter stay in the API: they are
  what the CLI and MCP server will use in their slice. A new endpoint
  still declares `@RequireScopes`, as `AGENTS.md` says.
- **A credential kind is a contribution, not something the auth layer
  knows.** `apps/api/src/auth` is a kernel: it recognises the two
  credentials it issues itself — a Better Auth session and an OAuth
  grant — and knows nothing else about who authenticates. Every other
  kind is registered by the module that owns it, which spreads
  `AuthModule.contributeCredentials([<Kind>CredentialResolver])` into its
  own providers: API tokens
  contribute theirs from `apps/api/src/api-tokens`, and a host's boot
  assertion is the `host` kind the hosts module contributes from
  `apps/api/src/hosts`. The kernel asks each
  registered resolver whether a presented credential is its own and
  takes the first that claims it; a resolver that claims one and then
  refuses it is the answer, so a stale credential never falls back to a
  session. What a credential authorizes (`ScopeContext`) and what the
  guards do with it are unchanged.
- **Roles.** The platform roles (`user`, `admin`, `superadmin`) and the
  org-scoped `owner` role are the only ones the MVP needs. The role
  editor and the admin console are carried for later, not part of the
  console.

## Open questions

1. Attach ticket lifetime and whether it is single-use (01-protocol.md).

Question 2 — whether a host pairing token is bound to the user who minted
it or only to the workspace — is **decided above**: the token is bound to
the user, and so is the host it creates. A token carries
`ownerUserId`, the row it redeems into carries the same column, and
neither carries a workspace.
