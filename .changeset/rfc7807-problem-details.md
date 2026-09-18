---
"@oppenheimer/backend-core": minor
"@oppenheimer/backend-ddd": minor
"@oppenheimer/shared": minor
"@oppenheimer/frontend-core": minor
"@oppenheimer/api-client": minor
"@oppenheimer/api": minor
"@oppenheimer/cli": minor
"@oppenheimer/mcp": minor
---

Serve every API error as an RFC 7807 problem document.

`AllExceptionsFilter` now answers with `application/problem+json` and the
standard members — `type`, `title`, `status`, `detail`, `instance` — plus the
`code`, `correlationId`, `timestamp` and `invalidParams` extensions, instead of
the ad-hoc `{ statusCode, code, message }` body.

- **Title vs detail.** `AppError` takes a second argument: `detail` (specific to
  one occurrence) and `extensions` (extra members). The catalog message stays
  the stable problem `title`, so handlers no longer interpolate request data
  into it — `TOKEN_002` and `TOKEN_005` now report the offending scopes in
  `detail` and as `ungrantableScopes` / `missingScopes`.
- **Validation failures** list every rejected field in `invalidParams`.
- **Domain exceptions** from `@oppenheimer/backend-ddd` carry an `httpStatus`, so a
  `NotFoundException` surfaces as 404 rather than a blanket 500.
- **5xx responses** no longer echo the underlying message; the correlation id
  ties the response to the logged stack trace.
- `type` URIs point at the new error reference (`https://oppenheimer.dev/errors`),
  configurable per deployment with `ERROR_TYPE_BASE_URL`.

The `ProblemDetails` wire type lives in `@oppenheimer/shared`, replacing the unused
`ApiErrorResponse`. The CLI and MCP clients
read problem documents (still understanding the old body shape),
`@oppenheimer/frontend-core` exposes `toAppError` and the `@MapApiError` method decorator so screens can show
the server's `detail` and per-field errors, and `ApiProblemResponse` puts the
schema in the OpenAPI document and the generated client.
