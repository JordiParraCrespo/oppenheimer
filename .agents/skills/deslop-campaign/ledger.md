# Deslop campaign ledger

Which pass has covered which area. Numbers are net comment lines removed. What
a pass found and did not fix goes in that pass's pull request, not here.

| Area | Paths | Pass 1 | Pass 2 |
| --- | --- | --- | --- |
| API sessions | `apps/api/src/sessions` | 1 | 60 |
| API hosts | `apps/api/src/hosts` | 1 | 240 |
| API auth | `apps/api/src/auth` | 0 | 121 |
| API GitHub | `apps/api/src/{github,links,inbound-events}` | 3 | 121 |
| API accounts | `apps/api/src/{organizations,roles,authz,admin}` | 5 | 190 |
| API automations | `apps/api/src/{automations,projects,outbox,queue}` | 1 | 49 |
| API relay and profile | `apps/api/src/{relay,profile,config,api-tokens}` | 1 | 167 |
| API rest | the rest of `apps/api` | 4 | 120 |
| Frontend core | `packages/frontend/{core,api-client}` | 3 | 87 |
| Frontend product and kit | `packages/frontend/{consumer,web,design-system}` | 3 | 106 |
| Web apps | `apps/{web,web-showcase,docs}` | 10 | 149 |
| e2e and scripts | `e2e`, `scripts` | 1 | 58 |
| Go | `apps/runner`, `packages/go` | 2 | 41 |
| Shared and backend | `packages/{shared,backend,auth,env,tsconfig,translations}` | 3 | 85 |
