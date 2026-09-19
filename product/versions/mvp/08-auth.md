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
- **Hosts belong to the workspace that paired them.** A host row carries
  the workspace id; the pairing token is minted by a signed-in user and
  the runner's keypair is bound to that host row. A host answers only to
  its own workspace.
- **Sessions belong to a host, so to a workspace.** Attaching to a
  session needs a session in the caller's workspace plus a short-lived
  attach ticket minted by the control plane (01-protocol.md). The relay
  checks the ticket, never the browser cookie, on the socket.
- **GitHub access is per session.** The control plane mints a one-hour
  installation token narrowed to the session's repository and hands it
  to the runner over the relay; nothing lands on disk (00-scope.md).
- **Scopes and API tokens** from the starter stay in the API: they are
  what the CLI and MCP server will use in their slice. A new endpoint
  still declares `@RequireScopes`, as `AGENTS.md` says.
- **Roles.** The platform roles (`user`, `admin`, `superadmin`) and the
  org-scoped `owner` role are the only ones the MVP needs. The role
  editor and the admin console are carried for later, not part of the
  console.

## Open questions

1. Attach ticket lifetime and whether it is single-use (01-protocol.md).
2. Whether host pairing tokens are bound to the user who minted them or
   only to the workspace.
