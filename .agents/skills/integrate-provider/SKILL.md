---
name: integrate-provider
description: Integrate a third-party service into the Oppenheimer API the way this codebase does it — the capability as one interface, each vendor as a provider behind it, one ordered list, one fallback rule, a status endpoint the console reads — so the next vendor is a class and a line. Use it whenever the user asks to integrate, connect, add or switch a third-party service, API, SaaS or vendor (speech-to-text, an LLM, email, SMS, payments, storage, search, a calendar, a model provider), to add another provider or vendor to something that already has one, to "make it easy to swap X later", or to call any outside API from apps/api, even if they never say "provider".
---

# Integrate a third-party service as providers

The rule this skill applies is `.agents/rules/provider-integrations.md`; the
rate-limit half is `.agents/rules/integrations.md`. Read both first. The
worked example is dictation, `apps/api/src/voice/`: read
`application/speech-provider.port.ts`, `speech-provider.registry.ts`,
`voice-transcription.resolver.ts` and `voice.module.ts` before writing
anything, and copy their shape rather than this page's prose.

The outcome to aim for: after this change, adding the **next** vendor for
the same capability touches one gateway, one provider class, one id and one
line in the module, and nothing in the console.

## 1. Decide the shape (ask, don't assume)

Answer these with the user, in their words, before any code:

1. **What is the capability**, as a verb the product needs ("hear a
   recording", "send a text message", "complete a prompt")? The interface is
   named for it (`SpeechProvider`), never for a vendor.
2. **Which vendors now, and which next?** If there is exactly one and no
   second is plausible (the GitHub App), stop: a port and a gateway are the
   whole shape (`integrations.md`). Say so and do that instead.
3. **Whose credential?** A workspace's own (a sign-in, a key it saved) means
   providers, per workspace. One key for the whole deployment, one vendor at
   a time, means a pluggable package or config (`backend-packages.md`) may be
   enough; providers are still right if several may be tried for one request.
4. **In what order are they tried, and why?** The order is a product
   decision; write it down.
5. **Does a client show or hide something** on whether the capability is
   available? Then it gets `GET /v1/<capability>/status`.

## 2. Write the budget before the adapter

For each vendor, in the gateway's doc comment (`integrations.md`): what it
counts and against what (the buckets), the windows, how it says "stop", and
what one request costs. If the vendor is undocumented, say so, say what
answers a change will look like, and make every one of them the module's
"provider unavailable" code rather than a crash.

## 3. Build it, inside out

For a **new capability** (no registry yet), in this order, using
`references/templates.md`:

1. **Shared:** the ids list (`<CAPABILITY>_PROVIDERS`) and the wire types in
   `packages/shared/src/schemas/<capability>.schema.ts`.
2. **Domain:** the module's error catalog, with a "not configured" code, a
   "provider unavailable" code and a rate-limit `429` code; any pure policy
   (what input is accepted, how an answer is cleaned).
3. **Infrastructure:** one gateway and its port per vendor, each with its own
   `UpstreamLimiter`.
4. **Application:** the provider port, one provider per vendor, the registry,
   and the resolver with the fallback rule exactly as the rule writes it.
5. **The module:** providers registered, the registry built with
   `useFactory` in the order from step 1, a comment saying how to add one.
6. **Slices:** the command (or query) that uses the resolver, and the status
   query if step 1 said a client gates on it.

For **one more provider** on an existing capability: steps 3, 4 (one
provider class), its id in step 1's list and its place in step 5's list.
Nothing else; if you find yourself editing the resolver or the console, stop
and ask why the shape did not hold.

Use `/scaffold-module` for a new module's skeleton, and keep to the module
contract (`pnpm check:api-structure`, `pnpm --filter @oppenheimer/api arch`).
Credentials another module owns are read through its published port
(`*.di-tokens.ts`, `*.port.ts`), never its tables.

## 4. The rest a route owes

- `@RequireScopes`, `@CheckPolicies` and the line in
  `apps/api/src/__tests__/route-scopes.inventory.json`; a `GET` never asks a
  write scope.
- Every new error code in `apps/docs/docs/errors.md` and every locale's
  `errors.json` (then `pnpm --filter @oppenheimer/translations assemble`).
- Config in the root `.env.example` with a note per variable; optional, so a
  missing key makes that provider unavailable, never a boot failure.
- A metrics group in `apps/api/src/health/infrastructure/http-metrics.config.ts`.
- `pnpm generate:api-client`, then the client reads the status through the
  product package (`packages/frontend/consumer`) and a feature shows or hides
  from it; never a capability flag plus a providers list of its own.
- A feature flag only if the rollout needs one (`feature-flags.md`).

## 5. Prove it

- The resolver spec over fake providers (typed by the port): every line of
  the fallback rule, and duplicate ids refused.
- Each provider over doubles of what it reads; each gateway against a
  `fetch` double: what it sends (and that it names itself honestly), a
  non-answer, a rate limit that pauses its bucket without a second call.
- A stub of one provider on the local stack: extend `e2e/support/` (the
  namer stub answers OpenAI-compatible routes) and `stub-env.ts`, then one
  API spec and, if the console changed, one web spec. Run them with the
  `/local-stack` skill, and take screenshots if the console shows it.
- `pnpm ci:local` green before the push (`/steward`).

## 6. Write it down

A product note (or a section of the capability's note) naming every vendor,
what each receives and keeps (privacy statements must stay true), the order
and why, and what the first real call still has to prove. When a decision in
an earlier note changes, add the line to that note's decision log.

## Patterns agents get wrong

- Naming the interface after the first vendor (`ChatgptService`), so the
  second vendor is a rename across the module.
- Writing the fallback in a call site, or letting one provider decide whether
  another runs. The resolver is the one place.
- Falling back on a rate limit, which spends a second vendor's budget and
  hides the first one's "not now".
- An `availableFor` that calls the vendor, so a status read costs a request.
- The console deciding availability from capabilities and settings it reads
  itself; it asks the status endpoint.
- Posing as another product's client or a browser to get past a vendor's
  gate. A provider names itself as Oppenheimer or is not shipped.
