---
name: integrate-provider
description: Integrate a third-party service into the Oppenheimer API the way this codebase does it — the capability as one interface, each vendor as a provider behind it, one ordered list, one fallback rule, a status endpoint the console reads — so the next vendor is a class and a line. Use it whenever the user asks to integrate, connect, add or switch a third-party service, API, SaaS or vendor (speech-to-text, an LLM, email, SMS, payments, storage, search, a calendar, a model provider), to add another provider or vendor to something that already has one, to "make it easy to swap X later", or to call any outside API from apps/api, even if they never say "provider".
---

# Integrate a third-party service as providers

The shape, the fallback rule and the tests it owes are
`.agents/rules/provider-integrations.md`; the rate-limit half is
`.agents/rules/integrations.md`. This page is only the order of work. Before
writing anything, read both rules and the worked example, and copy the
example's shape:

- `apps/api/src/voice/application/speech-provider.port.ts`
- `apps/api/src/voice/application/speech-provider.registry.ts`
- `apps/api/src/voice/application/voice-transcription.resolver.ts`
- `apps/api/src/voice/voice.module.ts`

The aim: after this change, the **next** vendor for the same capability is
the rule's "Adding a provider" and nothing else.

## 1. Decide the shape with the user

Ask, in their words, before any code:

1. **What is the capability**, as a verb the product needs ("hear a
   recording", "send a text message")? The interface is named for it, never
   for a vendor.
2. **Which vendors now, and which next?** With exactly one and no plausible
   second (the GitHub App), stop: a port and a gateway are the whole shape.
   Say so and build that instead.
3. **Whose credential?** A workspace's own means providers. One key for the
   whole deployment, one vendor at a time, may be a pluggable package
   (`backend-packages.md`) instead.
4. **In what order are they tried, and why?** Write the answer down; it is
   the module's list.
5. **Does a client show or hide something** on whether the capability is
   available? Then it gets the status endpoint.

## 2. Write each vendor's budget before its gateway

In the gateway's doc comment (`integrations.md`): what it counts and
against what, the windows, how it says "stop", what one request costs. For
an undocumented vendor, say so, and map every answer that is not the
expected one to the module's "provider unavailable" code.

## 3. Build it inside out

For a new capability: the shared ids and wire types, the module's error
catalog ("not configured", "provider unavailable", a `429`), the gateways,
the port and providers, the registry and the walk, the module's list, then
the slices (the command and, from step 1, the status query). Use
`/scaffold-module` for a new module and keep to its contract
(`pnpm check:api-structure`, `pnpm --filter @oppenheimer/api arch`).

For one more provider on an existing capability: the rule's "Adding a
provider", and stop if it asks for more.

## 4. What a route owes

`@RequireScopes`, `@CheckPolicies` and the line in
`apps/api/src/__tests__/route-scopes.inventory.json`; every new error code
in `apps/docs/docs/errors.md` and each locale's `errors.json`; config in
`.env.example`; a metrics group in `http-metrics.config.ts`;
`pnpm generate:api-client`; the client side of the status as the rule's
"The status the client reads" says; a feature flag only if the rollout
needs one (`feature-flags.md`).

## 5. Prove it

The tests the rule lists, then a stub of one provider on the local stack
(`e2e/support/` and `stub-env.ts`) with one API spec and, if the console
changed, one web spec, run with `/local-stack`, with screenshots when the
console shows it. `pnpm ci:local` before the push (`/steward`).

## 6. Write it down

A product note (or a section of the capability's note) naming every vendor,
what each receives and keeps, the order and why, and what the first real
call still has to prove.

## What goes wrong when this is skipped

- The interface is named after the first vendor, so the second is a rename
  across the module.
- The fallback is written at a call site, or one provider decides whether
  another runs.
- A rate limit falls through, spending a second vendor's budget and hiding
  the first one's "not now".
- `availableFor` calls the vendor, so every status read costs a request.
- The console works out availability itself instead of asking the status.
