---
paths:
  - "apps/api/src/**/*"
  - "packages/shared/src/schemas/voice.schema.ts"
  - "packages/shared/src/schemas/bot.schema.ts"
  - "packages/shared/src/schemas/cloud-agent.schema.ts"
---

# Third-party services are providers behind one interface

This file is the one description of the shape. The `/integrate-provider`
skill is the procedure that applies it; the worked example is
`apps/api/src/voice/` (dictation). When this page and that code disagree,
the code is what CI checks: fix the page.

When the product needs something a third party does (hear speech, send a
message, read a calendar, run a model), the product depends on **the
capability**, never on a vendor. The capability is one interface; each
vendor that can do it is a **provider** implementing it; the providers sit in
**one ordered list** the module builds. Adding a vendor is a class, its id
and a place in the list. Nothing else in the product changes.

This rule sits on top of two others and replaces neither:

- `integrations.md`: every call to a system we do not run goes through one
  `UpstreamLimiter.exchange`, with buckets for what the provider counts and a
  `429` code of its own. Each provider's gateway in `apps/api` still owes all
  of that. Providers live in an API module; a package with no workspace
  dependencies (`backend-llm`, `backend-email`) keeps the limit its own way,
  as that rule's "Outside the API" says.
- `backend-packages.md`: a pluggable package (`email`, `storage`, `llm`) picks
  **one** driver per deployment from config. Use that shape for plumbing the
  whole deployment shares. Use this one when the answer depends on the
  workspace (its own sign-in, its own key) or when more than one provider may
  be tried for one request.

## The shape

| Piece | Where |
| --- | --- |
| The capability's port: `id`, `availableFor(organizationId)`, `grantFor(organizationId, now)`, and the capability's own verb taking the grant | `<module>/application/<capability>-provider.port.ts` |
| One provider per vendor: reads its credential, calls its gateway, no HTTP | `<module>/application/<vendor>-<capability>.resolver.ts` |
| One gateway per vendor, with its port: the HTTP, its own `UpstreamLimiter`, the vendor's answers mapped onto the module's error codes | `<module>/infrastructure/<vendor>-<capability>.gateway.ts` |
| The ordered list, which refuses two providers with one id, built with `useFactory` in the module | `<module>/application/<capability>-provider.registry.ts` |
| The walk: the one place that decides fallback | `<module>/application/<capability>.resolver.ts` |
| The provider ids, `as const`, which the DTOs and the console name | `packages/shared/src/schemas/<capability>.schema.ts` |
| Whether a workspace can: a query slice asking the registry | `GET /v1/<capability>/status` |

- **`availableFor` never spends the vendor's budget.** It is a row or a
  config read; a status read that calls the vendor turns a page view into a
  rate limit.
- **The grant is opaque outside its provider.** It carries whatever that
  provider needs. When the grant can serve a later step of the capability,
  it names that in a typed field rather than the step asking which vendor
  answered.
- **The verb takes the grant, never an organization id.** The credential is
  looked up once, in `grantFor`, where a failure counts as that provider
  failing.

## The fallback rule, written once

The walk tries the providers available for the workspace, in order:

1. The first one that answers is the answer, with its `id`, so the response
   and the logs say who answered.
2. **Anything but a rate limit falls through to the next provider**: the
   vendor refused, changed its answer, was unreachable, the grant failed, or
   asking whether it was available failed. So the walk asks each provider's
   `availableFor` in order, inside the same `try`, never all of them up
   front.
3. **A rate limit is answered at once** (the module's `429` code). It is the
   vendor saying "not now"; spending the next provider's budget hides it.
4. When every available provider failed, the **first** failure is the
   answer: it is the provider the workspace would have used.
5. When none is available, the module's "not configured" code.

No provider decides whether another runs, and no call site re-implements
this. A capability that needs another rule (fan out to every provider, pick
by price) writes it in its walk and says why in the doc comment.

## Credentials stay where they live

- A credential another module owns is read only through the port that module
  publishes for it (`*.di-tokens.ts`, `*.port.ts`), never through its
  repository or tables, and never copied. If that port has no cheap "is there
  one" for `availableFor`, add it to the port rather than reaching past it.
- A deployment-wide key is config (`<MODULE>_<VENDOR>_*` in the root
  `.env.example`), optional: its absence makes that provider unavailable,
  never a boot failure (`api-config.md`).
- A provider names itself to the vendor as Oppenheimer. It never poses as
  another product's client or a browser to get past a vendor's gate; if the
  vendor only answers those, that provider is not one we ship.

## The status the client reads

- A client shows or hides the capability from `GET /v1/<capability>/status`
  alone, through the product package's query; never from deployment
  capabilities plus a providers list of its own.
- When the answer says anything about a workspace's credentials, its query
  prefix is in `CONSUMER_NON_PERSISTED_FEATURES`, and every mutation that
  changes one of those credentials invalidates it, in the same place it
  invalidates the credential list. A status the credentials screen does not
  re-read shows the answer from before a sign-in until the cache goes stale.

## Adding a provider to an existing capability

A gateway and its port, a provider class, its id in the shared list, and its
place in the module's list, where the order is a product decision the
comment explains. Config and an error row only if it needs them. If adding
one means editing the walk or the console, the shape did not hold: stop and
find out why.

## Tests the shape owes

- **The walk, over fake providers** typed by the port: first available wins,
  unavailable ones are never granted, a failure falls through (an
  `availableFor` that throws included), a rate limit does not, the first failure is the answer, none available is "not
  configured", two providers with one id are refused.
- **Each provider** over doubles of what it reads.
- **Each gateway** against a `fetch` double, as `integrations.md` lists.
- **One end-to-end spec** through a stub of one provider on the local stack
  (`e2e/support/`), so the route, the registry wiring and the client are
  proven together.

## What this is not

- **Not for a system we integrate with only one way** (the GitHub App, Better
  Auth). With no second provider to choose, a port and its gateway are the
  whole shape. Promote it when a second vendor is real.
- **Not a plugin system.** Providers are compiled in and listed in code; a
  workspace's choice is data (which credentials it has), never code loaded
  at run time.
- **Not a reason to hide the vendor.** The response names the provider that
  answered, and the product notes say which vendors exist and what each one
  keeps, so privacy statements stay true.
