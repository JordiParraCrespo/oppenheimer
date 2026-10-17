---
paths:
  - "apps/api/src/**/*"
  - "packages/backend/**/*"
  - "packages/shared/src/**/*"
---

# Third-party services are providers behind one interface

When the product needs something a third party does (hear speech, tidy text,
send a message, read a calendar, run a model), the product depends on **the
capability**, never on a vendor. The capability is one interface; each
vendor that can do it is a **provider** implementing it; the providers sit in
**one ordered list** the module builds. Adding a vendor is a class, its id and
a place in the list. Nothing else in the product changes.

Dictation is the worked example: `apps/api/src/voice/` (`SpeechProvider`,
`SpeechProviderRegistry`, `VoiceTranscriptionResolver`, `GET /v1/voice/status`)
and `product/next-steps/voice.md`. Walking through a new integration is the
`/integrate-provider` skill.

This rule sits on top of two others and replaces neither:

- `integrations.md`: every call to a system we do not run goes through one
  `UpstreamLimiter.exchange`, with buckets for what the provider counts and a
  `429` code of its own. Each provider's gateway still owes all of that.
- `backend-packages.md`: a pluggable package (`email`, `storage`, `llm`) picks
  **one** driver per deployment from config. Use that shape for plumbing the
  whole deployment shares. Use this one when the answer depends on the
  workspace (its own sign-in, its own key) or when more than one provider may
  be tried for one request.

## The shape

| Piece | Where | What it is |
| --- | --- | --- |
| The capability's port | `<module>/application/<capability>-provider.port.ts` | `id`, `availableFor(organizationId)`, `grantFor(organizationId, now)`, and the capability's own verb (`transcribe`, `send`, …) taking the grant |
| One provider per vendor | `<module>/application/<vendor>-<capability>.resolver.ts` | Implements the port. Reads its credential from where it lives (another module's port, config). Calls its gateway. No HTTP here |
| One gateway per vendor | `<module>/infrastructure/<vendor>-<capability>.gateway.ts` + its port | The HTTP, the `UpstreamLimiter`, the mapping of the vendor's answers onto the module's error codes |
| The list | `<module>/application/<capability>-provider.registry.ts`, built in `<module>.module.ts` with `useFactory` | The providers in the order a request tries them. Refuses two with one id |
| The walk | `<module>/application/<capability>.resolver.ts` | The one place that decides fallback (below) |
| The ids | `packages/shared/src/schemas/<capability>.schema.ts` | `as const` list of provider ids, which the response DTOs and the console name |
| Whether a workspace can | `GET /v1/<capability>/status` (a query slice) | Asks the registry; a client shows or hides the feature from this, never from capabilities or a providers list of its own |

### The port

```ts
export interface SpeechProvider<A = unknown> {
  readonly id: VoiceProvider;
  /** Cheap: a row or a config read, never a call to the vendor. */
  availableFor(organizationId: string): Promise<boolean>;
  /** The credential for one call, refreshed if it must be. May throw (a lapsed sign-in). */
  grantFor(organizationId: string, now: Date): Promise<SpeechGrant<A>>;
  transcribe(clip: VoiceClip, grant: SpeechGrant<A>): Promise<string>;
}
```

- **`availableFor` never spends the vendor's budget.** It is asked on every
  status read and before every request; a status endpoint that calls the
  vendor turns a page view into a rate limit.
- **The grant is opaque outside the provider.** It carries whatever that
  provider needs (a token, nothing). When the grant can serve a second step
  (dictation's polish runs on the model credential a ChatGPT sign-in
  brings), the grant names it in a typed field (`polishOn`) rather than the
  next step asking which vendor it was.
- **The verb takes the grant, never an organization id.** Credential
  lookups happen once, in `grantFor`, where a failure counts as this
  provider failing.

### The walk: one fallback rule, written once

The resolver tries the providers available for the workspace, in order:

1. The first one that answers is the answer, with its `id` so the response
   (and the logs) say who answered.
2. **Anything but a rate limit falls through to the next provider**: the
   vendor refused, changed its answer, was unreachable, or the grant failed.
3. **A rate limit is answered at once** (the module's `429` code). It is the
   vendor saying "not now"; spending the next provider's budget hides it.
4. When every available provider failed, the **first** failure is the
   answer: it is the provider the workspace would have used.
5. When none is available, the module's "not configured" code.

No provider decides whether another runs, and no call site re-implements
this. A capability that genuinely needs another rule (fan out to every
provider, pick by price) writes that rule here, in the resolver, and says why
in its doc comment.

### Credentials stay where they live

- A workspace's sign-in or key that another module owns (the bots module's
  model provider credentials) is read through that module's published port
  (`TURN_CREDENTIALS`, the repository port), never by reading its tables or
  keeping a second copy of the secret.
- A deployment-wide key is config (`<MODULE>_<VENDOR>_*` in the root
  `.env.example`), optional, and its absence makes that provider unavailable,
  never a boot failure (`api-config.md`).
- A provider that identifies itself to the vendor says it is Oppenheimer
  (`originator: oppenheimer`). It never poses as another product's client or
  a browser to get past a vendor's gate; if the vendor only answers those,
  that provider is not one we ship.

## Adding a provider to an existing capability

1. A gateway and its port in `infrastructure/`, with the vendor's budget
   written in its doc comment and every call through its own
   `UpstreamLimiter` (`integrations.md`).
2. A provider class in `application/` implementing the capability's port.
3. Its id in the capability's `*_PROVIDERS` list in `packages/shared`.
4. Its place in the registry's list in the module, where the order is the
   product decision; say why it goes where it goes.
5. Config in `.env.example` if it needs any; a row in `errors.md` and every
   locale only if it adds a code (it usually reuses the capability's).
6. Tests: its gateway against a `fetch` double (what it sends, a non-answer,
   a rate limit pausing its bucket); the provider's `availableFor` and
   `grantFor` over doubles of the ports it reads. The fallback is already
   covered by the resolver's spec over fake providers.

## Tests the shape owes

- **The resolver, over fake providers** (plain objects typed by the port):
  first available wins, unavailable ones are never granted, a failure falls
  through, a rate limit does not, the first failure is the answer, none
  available is "not configured", two providers with one id are refused.
- **Each provider** over doubles of what it reads.
- **Each gateway** against a `fetch` double, as `integrations.md` lists.
- **One end-to-end spec** through a stub of one provider on the local stack
  (`e2e/support/`), so the route, the registry wiring and the client are
  proven together.

## What this is not

- **Not for a system we integrate with only one way** (the GitHub App, Better
  Auth). There is no second provider to choose; a port and its gateway are
  the whole shape. Promote it to this shape when a second vendor is real.
- **Not a plugin system.** Providers are compiled in and listed in code; a
  workspace's choice is data (which credentials it has), never code loaded
  at run time.
- **Not a reason to hide the vendor.** The response names the provider that
  answered, and the product notes say which vendors exist and what each one
  stores, so privacy statements stay true.
