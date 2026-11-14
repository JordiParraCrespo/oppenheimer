# @oppenheimer/backend-core

## 0.4.0

### Minor Changes

- 18e4a35: A bot turn no longer dies with "unsupported Unicode escape sequence" when a
  tool brings in text Postgres cannot store, such as an invoice PDF whose text
  layer holds NUL bytes (#728). The chat's messages drop NULs and replace lone
  surrogate halves before they are written (`storableText` and `storableJson` in
  `@oppenheimer/backend-core`), and `read_mail_attachment` cleans what it
  extracts. A call whose result is still refused fails that call alone, and the
  turn goes on; any other refused write ends the turn with the new failure kind
  `storage`, whose card says the fault is ours, not the model provider's.
- 581c202: Bot settings polish (`product/versions/mvp/25-bots.md`, 2026-10-16).

  - `@oppenheimer/api`: `GET /bots/:id/conversation/export` streams the whole
    chat as NDJSON, one message per line, a page at a time; `DELETE /bots/:id/conversation` clears it (turns,
    messages, cards, summary, sidebar line) in one transaction, refused with
    `BOTS_022` while a turn is queued or running; the conversation read
    carries `messageCount`.
  - `@oppenheimer/api-client`: `exportBotConversation`, `clearBotConversation`,
    `messageCount`.
  - `@oppenheimer/frontend-consumer`: `useSuspenseBotHistory`,
    `useExportBotConversation` (reads the NDJSON stream a line at a time),
    `useClearBotConversation`.
  - `@oppenheimer/backend-core`: `ndjsonLines` and `NDJSON_CONTENT_TYPE`.
  - `@oppenheimer/frontend-web`: `SettingsFormSaveRow`, the dirty / pending /
    saved foot of a settings form.
  - `@oppenheimer/design-system-web`: `SettingsListRow`'s `kind` tag never wraps;
    the meta beside it does.
  - `@oppenheimer/translations`: Home host, chat history, `BOTS_022`, and the
    shorter ChatGPT sign-in chip.

- 3b73d6f: The API reports errors to Sentry when `SENTRY_DSN` is set.

  - `@oppenheimer/backend-error-reporting` (new): the `ErrorReporter` port,
    its Sentry driver and a no-op, `initErrorReporting` (run before Nest so
    HTTP, Express, Postgres, ioredis and BullMQ are traced) and
    `ErrorReportingModule`. Every event is scrubbed: no body, cookie, token or
    secret-named parameter, and the user reduced to an id.
  - `@oppenheimer/backend-core`: `AllExceptionsFilter` reports every 5xx, an
    unforeseen one as an error and a curated one as a warning grouped by its
    code, with the route, the user and the workspace.
  - `@oppenheimer/api`: a BullMQ job out of retries is reported, whichever
    processor ran it; a bot turn that threw outside the catalog, or that the
    engine failed without a kind, is reported with its bot, provider and model.
    `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` and
    `SENTRY_TRACES_SAMPLE_RATE` are new; the dev deployment sets the release to
    its commit. The unused `@sentry/nestjs` dependency moves into the package.

- 2e5879e: Observability for the bots, the cache and the logs. The API exports `bot_engine_*` metrics for every bot turn and completion (runs by how they ended, failures by kind, tokens with the prompt cache's share, duration, tool calls, retries) and `cache_reads_total` for the Redis cache (hits, misses, errors by namespace), with a Grafana dashboard and alerts for both. `LOG_FILE` also writes the API's log lines as JSON to a file, which `pnpm monitoring:up` now ships to Loki through Grafana Alloy, and `pnpm logs` queries with LogQL. `@oppenheimer/backend-cache` takes an `onRead` observer; `@oppenheimer/backend-core`'s logging takes a `file`.
- 1ee269e: Rate limits are kept before the provider says them, and a bot treats one as
  a wait.

  - `@oppenheimer/backend-core`: `UpstreamLimiter` takes a `budget` (units a
    window per bucket) and `exchange` a call's `cost`; a call the window cannot
    hold pauses the bucket until the window ends and is refused without being
    sent, shared across replicas through the store's `incrementBy`.
    `GoogleOAuthClient.fetch` takes the call's units. `upstreamRateLimitOf`
    reads `{ system, resetAt }` back off any integration's rate-limit problem.
  - `@oppenheimer/backend-cache`: `CacheService.incrementBy`, one atomic add
    that sets the TTL of a new key.
  - `@oppenheimer/api`: Gmail spends each call's quota units from 12,000 a
    minute per account. A bot's tool answers a rate limit as who is limiting,
    until when, and not to retry in the turn, without the provider's text; a
    bulk Gmail write the limit stopped partway answers what it changed and what
    it did not reach; and a goal's next turn waits for the limit's end instead
    of running into it again.

- 4c9f67c: `@oppenheimer/backend-core` gains `configKeySealer`, the one sealer every module
  that stores a secret binds to its own token, and `GoogleOAuthClient`, the Google
  grant (consent URL, code exchange, access tokens, revocation, every call through
  the integration's limiter) Gmail and the calendar now share. No behaviour
  changes: the sealed layout and every error code are as before.

### Patch Changes

- 1df2b19: Long pastes in a bot's chat, the way Claude Code and Codex hold them.

  - `@oppenheimer/web`: the bot composer holds a paste over 1,000 characters or
    10 lines as one label, `[Pasted text #1 +1000 lines]`, and sends the pasted
    text in its place; Backspace or Delete takes a label out whole. A message
    longer than a bot takes keeps send off and says so. A long message you sent
    is folded in the chat to its first twelve lines, with Show all.
  - `@oppenheimer/shared`: `BOT_MESSAGE_MAX` is 80,000 characters (was 16,000),
    room for a pasted log of a thousand lines or more, and never larger than the
    history a turn re-sends.
  - `@oppenheimer/api`: the JSON body limit is 512 KB (was Express's 100 KB), so a
    message at that length reaches the API.
  - `@oppenheimer/backend-core`: `SanitizePipe` strips tags with a linear scan;
    its regex took quadratic time on a body of unclosed `<`.
  - `@oppenheimer/mcp`: `ask_bot` takes the same longer message.
  - `@oppenheimer/translations`: `bots.chat.pasted`, `bots.chat.fold`,
    `bots.chat.tooLong`.

- 9e38d81: GitHub webhook deliveries over 100 kB are accepted again: the webhook reads its body raw, up to GitHub's own 25 MB cap, and anything larger gets a 413. A client error that body-parser raises (413, 415, an aborted body) now keeps its status instead of turning into a 500 and an error report.
- Updated dependencies [a602949]
- Updated dependencies [7b0e91d]
- Updated dependencies [1d57cbf]
- Updated dependencies [43193e4]
- Updated dependencies [dfd07de]
- Updated dependencies [1df2b19]
- Updated dependencies [db21b92]
- Updated dependencies [344ce8c]
- Updated dependencies [d314623]
- Updated dependencies [d5d4fd4]
- Updated dependencies [c5c09d0]
- Updated dependencies [be15bdc]
- Updated dependencies [38ffaaf]
- Updated dependencies [e315b92]
- Updated dependencies [a51a958]
- Updated dependencies [b283349]
- Updated dependencies [cfa236a]
- Updated dependencies [434deea]
- Updated dependencies [0d83e40]
- Updated dependencies [9ccced3]
- Updated dependencies [6568fab]
- Updated dependencies [a7c8731]
- Updated dependencies [c4b0995]
- Updated dependencies [be941d8]
- Updated dependencies [b639f26]
- Updated dependencies [4faf606]
- Updated dependencies [3d54930]
- Updated dependencies [18e4a35]
- Updated dependencies [7f18bbe]
- Updated dependencies [8fc6c25]
- Updated dependencies [39dbe36]
- Updated dependencies [502a40c]
- Updated dependencies [ac929fa]
- Updated dependencies [5dfebed]
- Updated dependencies [e338973]
- Updated dependencies [87d0f96]
- Updated dependencies [39d9703]
- Updated dependencies [59809f9]
- Updated dependencies [060dabb]
- Updated dependencies [a23f236]
- Updated dependencies [e0047a2]
- Updated dependencies [f09b6b3]
- Updated dependencies [3dbe5f1]
- Updated dependencies [629ea1d]
- Updated dependencies [bc448db]
- Updated dependencies [6af341b]
- Updated dependencies [0f9c3ca]
- Updated dependencies [2128771]
- Updated dependencies [f93ffbe]
- Updated dependencies [8b529a9]
- Updated dependencies [c11f8a3]
- Updated dependencies [8baff58]
- Updated dependencies [9f858e0]
- Updated dependencies [b39d40f]
- Updated dependencies [33cb1d8]
- Updated dependencies [55acf65]
- Updated dependencies [3230edb]
- Updated dependencies [f6a81a2]
- Updated dependencies [61f1092]
- Updated dependencies [dc67559]
- Updated dependencies [6eb8d65]
- Updated dependencies [3b73d6f]
- Updated dependencies [17e4cd5]
- Updated dependencies [d68e9c4]
- Updated dependencies [500ddd1]
- Updated dependencies [33cb1d8]
- Updated dependencies [ab9a6f4]
- Updated dependencies [aeeb48b]
- Updated dependencies [291469b]
- Updated dependencies [fda123f]
- Updated dependencies [85c11ad]
- Updated dependencies [48da240]
- Updated dependencies [1484bc6]
- Updated dependencies [7c0a70c]
- Updated dependencies [c63402e]
- Updated dependencies [0ed584c]
- Updated dependencies [814aa6c]
- Updated dependencies [5b48b5e]
- Updated dependencies [9b0c57f]
- Updated dependencies [6bb3a80]
- Updated dependencies [a3cf769]
- Updated dependencies [a3a780b]
- Updated dependencies [da6226c]
- Updated dependencies [3b5d381]
- Updated dependencies [9871b11]
- Updated dependencies [250c8d6]
- Updated dependencies [a80436f]
- Updated dependencies [d4606c6]
- Updated dependencies [1dbae54]
- Updated dependencies [6917f62]
- Updated dependencies [8b772b8]
- Updated dependencies [fe891c1]
- Updated dependencies [d69ddc4]
- Updated dependencies [ea93480]
- Updated dependencies [45d642b]
- Updated dependencies [fe61b51]
- Updated dependencies [1f7f57b]
- Updated dependencies [b5a9490]
- Updated dependencies [f8eda6e]
- Updated dependencies [db4ae58]
- Updated dependencies [13374f0]
- Updated dependencies [a68c88c]
- Updated dependencies [a69aa94]
- Updated dependencies [2d187ed]
- Updated dependencies [5b1c52a]
- Updated dependencies [1af8fa3]
- Updated dependencies [4ee069d]
  - @oppenheimer/shared@0.4.0
  - @oppenheimer/backend-error-reporting@0.2.0
  - @oppenheimer/backend-ddd@0.4.0

## 0.3.0

### Minor Changes

- a0e23bd: Operations are named by one factory and a collision fails generation; nullable enums list `null` (`nullableEnum`).
- eeaf30a: Remove the starter's unused exports and add the helpers the API repeated by hand.

  - Removed: the `Mapper` interface (the API's mappers use
    `@oppenheimer/backend-ddd`'s), `ZodValidationPipe` (the API registers
    `nestjs-zod`'s), `PaginatedRequest` and `paginationSchema` (use
    `paginationSchema` from `@oppenheimer/shared`, which reads `PAGINATION`),
    and the `RequestContextService` re-export (import it from
    `@oppenheimer/backend-ddd`).
  - Added: `toPageMeta(page)`, a paginated response's `meta` from a
    repository's `Paginated` result (`totalPages` is 0, never `Infinity`, for a
    limit of 0); `PaginatedResponseDto(Item, Meta)`, a base class for a
    paginated response DTO's `data` / `meta`; and `requireFound(option, error,
options?)`, the value of a lookup or the given `AppError`.

- 65a7b1c: Export `describeError(error: unknown): string`: an `Error`'s message, or any
  other thrown value as a string, for the log lines of best-effort paths.
- f099524: Add `CapabilitiesService`, which resolves the deployment's optional features from config once at boot.
- f099524: Add `ApiAuthProblemResponses()`, which documents the 401/403 every guarded route can produce.
- 3de723c: Open the request's correlation id in middleware, so a guard's refusal carries it.

  - Removed: `RequestContextInterceptor`. Guards run before interceptors, so a
    401, 403 or 429 a guard threw went out with no `correlationId`.
  - Added: `RequestContextMiddleware`, which the API applies to every route in
    `AppModule.configure`, and `resolveCorrelationId` / `isValidCorrelationId` /
    `CORRELATION_HEADER`. An inbound `x-correlation-id` is honoured only when it
    is 1–64 characters of `[A-Za-z0-9._:-]` (the first value of a repeated
    header); anything else becomes a fresh UUID.
  - `buildPinoHttpOptions` sets `genReqId`, so the request log's `req.id` is the
    correlation id (no longer pino's counter), and every response, including the
    Better Auth routes, echoes it as `x-correlation-id`.

- f099524: `LoggingModule` wraps `nestjs-pino` with hardened defaults — no headers, query strings or bodies in request lines — and attaches `userId` and the credential's effective scopes once the auth guards resolve.
- fe25a5e: Prometheus metrics.

  - `@oppenheimer/backend-core` gains `MetricsModule.forRoot` (the application's
    own registry, with process metrics), `createMetricsProvider` /
    `InjectMetric` for a module's own counters, gauges and histograms, and
    `HttpMetricsModule.register`: `http_requests_total{route,status_class}` and
    `http_request_duration_seconds{route}`, labelled by route group through a
    policy the application owns (at most 100 rules and 20 groups), every series
    created at zero, aborted connections counted apart and never timed. Built on
    `@prometheus-io/client`, the maintained successor of `prom-client`.
  - The API serves the registry at `GET /api/v1/metrics` when `METRICS_TOKEN` is
    set, to HTTP Basic auth with the token as password, and answers 404
    otherwise. The endpoint is not in the OpenAPI document.

- f099524: `AllExceptionsFilter` answers with `application/problem+json` and the RFC 7807 members, plus `code`, `correlationId`, `timestamp` and `invalidParams`, in place of `{ statusCode, code, message }`. A 5xx no longer echoes the underlying message.
- 024f31b: User and role search match `%` and `_` literally.

  - Added `likeContains(term)` to `@oppenheimer/backend-core`: an `ILIKE`
    contains-pattern with the term's `%`, `_` and `\` escaped.
  - `GET /v1/users?search=` and `GET /v1/roles?search=` use it, so `a_b` no
    longer matches `axb` and `%` no longer matches every row. `search` is trimmed
    and capped at 100 characters (documented as `maxLength` in the OpenAPI
    document; a longer term is a 400).

- 818f20c: `GITHUB_015` and `CALENDAR_010` are 429s with `Retry-After`, declared on every route that reaches GitHub or Google. `@oppenheimer/backend-core` gains `UpstreamLimiter` and `AppError.retryAfterSeconds`; `@oppenheimer/backend-cache` gains `CacheService.setMax`.

### Patch Changes

- 369c7f8: Authorization stops re-reading roles on every request.

  - `@oppenheimer/api`: a user's role-derived permissions are cached in Redis,
    keyed on three version counters read in one query per request — the
    organization's `roleVersion`, the new `role_catalog_version` (global roles)
    and `user_role_version` (a user's global assignments), added by migration
    `AddAuthzVersions`. Every role and assignment write bumps the counter that
    covers it in its own transaction, so a revocation is visible on the next
    request on every replica. Platform roles resolve from an in-process snapshot
    of the global roles; the access-scope interceptor reuses the role ids the
    ability was built from and reads team membership in one join. A warm
    guarded, scoped request makes 3 authorization queries instead of 6. Redis
    failing falls back to the database.
  - `@oppenheimer/backend-core`: `requestMemo(request, key, compute)`, one
    in-flight computation per key per request, evicted on rejection.
  - `@oppenheimer/backend-authz`: `ResolveScopeInput.roleIds`, optional, for a
    caller that already knows the roles.

- 64d3f7a: Remove the Stripe `billing` module and the `leads` example the project
  inherited from the Flama starter. Neither was ever composed into the API, so no
  endpoint a deployment served goes away; what goes is everything that existed
  only for them. Stripe billing can be brought back from the Flama starter's
  `billing` plugin, then `pnpm generate:api-client`.

  These are breaking changes for anything that imported the removed names, which
  is why the packages below take a minor bump while they are on 0.x.

  - `@oppenheimer/api` drops `src/billing`, `src/leads`, the `stripe` config and
    the `stripe` dependency, and the `stripe_billing` capability (and with it the
    property on `GET /health/capabilities`). The `lead`, `subscription` and
    `billing_customer` tables, which nothing ever wrote, are gone from the
    schema. The `STRIPE_*`
    variables leave `.env.example`.
  - `@oppenheimer/shared` drops the `billing` and `leads` scope resources and
    permission groups (so the `billing:*` and `leads:*` scopes), the
    `stripe_billing` deployment and client capability, the `Billing` subject, the
    `GET /billing/subscriptions` endpoint policy and the billing and lead schemas.
  - `@oppenheimer/api-client` drops the legacy `BillingApi` and `LeadsApi`
    services and their models, and the regenerated types no longer carry the
    removed scopes or `stripe_billing`.
  - `@oppenheimer/translations` drops the `BILLING_*` and `LEAD_*` error copy and
    the unused billing entry of the team page's permission areas.
  - `@oppenheimer/backend-core`: the capabilities registry's docs no longer use
    Stripe as their example.

- 8e2de68: `SanitizePipe` no longer rewrites custom route parameters. It rebuilds objects
  to strip HTML, which is right for a JSON body and destructive for anything a
  `createParamDecorator` read off the request: a `Map` came back as `{}` and a
  class instance lost its prototype, so a resolved access scope reached a
  repository with no `grants.get`. Bodies, query strings and route parameters are
  sanitized exactly as before.
- Updated dependencies [27af598]
- Updated dependencies [cb56034]
- Updated dependencies [f099524]
- Updated dependencies [604707a]
- Updated dependencies [64d3f7a]
- Updated dependencies [f099524]
- Updated dependencies [a880b19]
- Updated dependencies [7945f7e]
- Updated dependencies [3de723c]
- Updated dependencies [affe343]
- Updated dependencies [22e89e4]
- Updated dependencies [fad86a0]
- Updated dependencies [5a88302]
- Updated dependencies [09cea4c]
- Updated dependencies [f099524]
- Updated dependencies [7ed4e17]
- Updated dependencies [79e30e5]
- Updated dependencies [83f3617]
- Updated dependencies [c078d0d]
- Updated dependencies [8e2de68]
- Updated dependencies [fc0e75d]
- Updated dependencies [88f7898]
- Updated dependencies [2202daa]
- Updated dependencies [5bd4a8b]
- Updated dependencies [ed28ce2]
- Updated dependencies [f099524]
- Updated dependencies [249b51b]
- Updated dependencies [1c2ae71]
- Updated dependencies [c3c7883]
- Updated dependencies [2d00e7e]
- Updated dependencies [2dc27d2]
- Updated dependencies [e505b9e]
- Updated dependencies [0918701]
- Updated dependencies [a23b14e]
- Updated dependencies [173bb4c]
- Updated dependencies [cefbc53]
- Updated dependencies [9ffae03]
- Updated dependencies [38b511f]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [dcc5fe1]
- Updated dependencies [bbacd49]
- Updated dependencies [5b93fd7]
- Updated dependencies [f099524]
- Updated dependencies [8fab63d]
- Updated dependencies [b2fd6a1]
- Updated dependencies [a566fac]
- Updated dependencies [064c443]
- Updated dependencies [3404cd3]
- Updated dependencies [bb3c4e8]
- Updated dependencies [ca05d90]
- Updated dependencies [f101364]
- Updated dependencies [8f5fd3d]
- Updated dependencies [097956a]
- Updated dependencies [b6676f8]
- Updated dependencies [b336aae]
- Updated dependencies [a81af0d]
  - @oppenheimer/shared@0.3.0
  - @oppenheimer/backend-ddd@0.3.0

## 0.2.0

### Minor Changes

- aa0eefd: Refactor the API toward Domain-Driven Hexagon architecture.

  - Add `@oppenheimer/backend-ddd`, a building-blocks package with `Entity`,
    `AggregateRoot`, `ValueObject`, `DomainEvent`, `CommandBase`, `QueryBase`,
    the `RepositoryPort`/`Paginated` abstractions, a domain/persistence/response
    `Mapper` interface, domain exceptions and `Guard`.
  - Restructure the users module into vertical slices (`commands/`, `queries/`,
    `domain/`, `database/`, `dtos/`, `application/`) on top of `@nestjs/cqrs`,
    with a `UserEntity` aggregate, an `Email` value object, a
    `UserRepositoryPort` and its TypeORM adapter, and domain-event publishing.
  - Invert the `@oppenheimer/backend-ddd` ↔ `@oppenheimer/backend-core` layering: the
    framework-free `RequestContextService` and the `ErrorDefinition` contract now
    live in `@oppenheimer/backend-ddd` (re-exported from `@oppenheimer/backend-core` for
    backwards compatibility), so the domain layer depends on no infrastructure.
  - Document the architecture in `apps/api/ARCHITECTURE.md`, add a
    `/scaffold-module` skill, and enforce the layer boundaries with
    dependency-cruiser (`pnpm arch`, wired into CI and a Stop hook).

### Patch Changes

- Updated dependencies [aa0eefd]
  - @oppenheimer/backend-ddd@0.2.0
