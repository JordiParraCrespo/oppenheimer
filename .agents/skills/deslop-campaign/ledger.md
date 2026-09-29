# Deslop campaign ledger

Where each area stands. A pass updates its column and adds what it reported
rather than fixed. Numbers are net comment lines removed.

## Areas

| Area | Paths | Pass 1 | Pass 2 |
| --- | --- | --- | --- |
| API sessions | `apps/api/src/sessions` | 1 | 60 |
| API hosts | `apps/api/src/hosts` | 1 | 240 |
| API auth | `apps/api/src/auth` | 0 | 121 |
| API GitHub | `apps/api/src/{github,links,inbound-events}` | 3 | 121 |
| API accounts | `apps/api/src/{organizations,roles,authz,admin}` | 5 | 193 |
| API automations | `apps/api/src/{automations,projects,outbox,queue}` | 1 | 49 |
| API relay and profile | `apps/api/src/{relay,profile,config,api-tokens}` | 1 | 170 |
| API rest | the rest of `apps/api` | 4 | 123 |
| Frontend core | `packages/frontend/{core,api-client}` | 3 | 87 |
| Frontend product and kit | `packages/frontend/{consumer,web,design-system}` | 3 | 110 |
| Web apps | `apps/{web,web-showcase,docs}` | 10 | 153 |
| e2e and scripts | `e2e`, `scripts` | 1 | 58 |
| Go | `apps/runner`, `packages/go` | 2 | 41 |
| Shared and backend | `packages/{shared,backend,auth,env,tsconfig,translations}` | 3 | 85 |

Pass 1: the restatement cut, one subagent per area group, plus the review
follow-ups (`CURVE25519_P`, the kernel `timestamp` docs). Pass 2: the depth cut,
fourteen subagents, then a verify step that re-read every fully deleted
multi-sentence block and restored the ones whose reason survived nowhere else.

## Reported, not fixed

Comments that are wrong about the code. Fixing them is a content change, not a
cut, so each waits for someone who owns the area.

- `apps/api/src/projects/projects.resource.ts` says the API creates a project
  when a session names none; nothing derives a project from a repository.
- `apps/api/src/api-tokens`: `RevokeApiTokenCommandHandler` says "the auth
  layer" handles the revoke event; this module's own handler does.
- `apps/api/src/sessions`: close-session, `session-dispatch.port` and
  `sessions.module` still say the relay "does not exist yet";
  `session-checkout.orm-entity`'s `branch` shows `oppenheimer/<project>/<slug>`
  where branches are `oppenheimer/<slug>`; `session-layout.policy` says the
  directory-name list cannot be exhausted, but the function returns null when it is.
- `apps/api/src/hosts/database/host.orm-entity.ts`: `lastSeenAt` says "Last
  heartbeat", which no longer writes that column.
- `apps/api/src/app.module.ts` mentions mobile apps; `RedisThrottlerStorage`'s
  fail-open note relies on a proof-of-human check at the edge that may not exist.
- `apps/web/src/app.tsx` says tokens live in localStorage; auth is cookie-based.
- `apps/web/src/features/sessions/lib/terminal-theme.ts`: the note on
  `'Oppenheimer Symbols'` says it claims only the private-use ranges; its
  `@font-face` in `globals.css` also claims arrows, dingbats and box drawing,
  and says why the private-use planes alone were not enough.
- `apps/runner/internal/updates/domain/release.go`: "until then an idle host is
  the honest answer" may be out of date.
- `e2e/support/db.ts`: `findResetToken` says "newest unexpired"; the query does
  not filter on expiry. `scripts/check-api-structure.test.mjs` says "same path"
  where the path differs.
- `packages/shared/src/scopes/scope.ts`: `parseScope` was documented as
  throwing on an unknown scope and never does (the doc is gone; whether it
  should validate is open).

Code, not comments:

- `RepositoryRef` is declared twice, in
  `packages/frontend/consumer/src/react/installations.queries.ts` and
  `…/modules/installations/repository-key.ts`.
- `e2e/support/sessions.ts:62` derives the GitHub installation id from the pid,
  so two workers can collide (`GITHUB_003` in `sessions.spec.ts`).

## Pass 3 candidates

Notes repeated across files, to move into the module that owns the rule:

- the 401 → `/login` rule (`AuthService.expireSession`, `query-client.ts`);
- the capabilities failure rule (hook, repository, spec header);
- the cookie note (`core.module.ts`, `configure.ts`);
- "hooks cannot inject" (about four files in `apps/api/src/auth`) and the
  admin-ban rotation rationale (three);
- Better Auth's session copy of the user (three profile handlers and specs);
- the organization, admin and invitation gateways against their ports;
- the tmux probe notes (`integration_test.go`, `tmux_test.go`);
- the "0 repositories" note, the chip `failure`/`variant` docs, "Unassigned
  under its translated name", and the `?project=`/`?host=` notes in `apps/web`;
- the design-system "Component — …" file headers sitting on a helper instead
  of the component (about 31 files).
