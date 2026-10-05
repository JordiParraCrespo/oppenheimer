# Deslop campaign ledger

Which pass has covered which area. Numbers are net comment lines removed. What
a pass found and did not fix goes in that pass's pull request, not here.

| Area | Paths | Pass 1 | Pass 2 | Pass 3 | Pass 4 | Pass 5 | Pass 6 | Pass 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| API sessions | `apps/api/src/sessions` | 1 | 60 | 185 | 100 | 22 | 1 | -1 |
| API hosts | `apps/api/src/hosts` | 1 | 240 | 104 | 29 | 9 | 3 | -1 |
| API auth | `apps/api/src/auth` | 0 | 121 | 169 | 25 | 0 | 0 | 8 |
| API GitHub | `apps/api/src/{github,links,inbound-events}` | 3 | 121 | 79 | 15 | 19 | 7 | 1 |
| API accounts | `apps/api/src/{organizations,roles,authz,admin}` | 5 | 190 | 154 | 61 | 9 | 9 | 0 |
| API automations | `apps/api/src/{automations,projects,outbox,queue}` | 1 | 49 | 88 | 24 | 5 | 9 | 0 |
| API relay and profile | `apps/api/src/{relay,profile,config,api-tokens}` | 1 | 167 | 141 | 101 | 9 | 13 | 1 |
| API rest | the rest of `apps/api` | 4 | 120 | 125 | 52 | 3 | 8 | 0 |
| Frontend core | `packages/frontend/{core,api-client}` | 3 | 87 | 68 | 82 | 5 | 2 | 0 |
| Frontend product and kit | `packages/frontend/{consumer,web,design-system}` | 3 | 106 | 214 | 41 | 71 | 8 | -3 |
| Web apps | `apps/{web,web-showcase,docs}` | 10 | 149 | 532 | 34 | 24 | 7 | -1 |
| e2e and scripts | `e2e`, `scripts` | 1 | 58 | 120 | 34 | 2 | -1 | 0 |
| Go | `apps/runner`, `packages/go` | 2 | 41 | 27 | 39 | 11 | 7 | 1 |
| Shared and backend | `packages/{shared,backend,auth,env,tsconfig,translations}` | 3 | 85 | 84 | 176 | 30 | 11 | -2 |
