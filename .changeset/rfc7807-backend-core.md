---
"@oppenheimer/backend-core": minor
---

`AllExceptionsFilter` now answers with `application/problem+json` and the
RFC 7807 standard members — `type`, `title`, `status`, `detail`, `instance` —
plus the `code`, `correlationId`, `timestamp` and `invalidParams` extensions,
instead of the ad-hoc `{ statusCode, code, message }` body.

- **Title vs detail.** `AppError` takes a second argument: `detail` (specific
  to one occurrence) and `extensions` (extra members). The catalog message
  stays the stable problem `title`, so handlers no longer interpolate request
  data into it.
- **Validation failures** list every rejected field in `invalidParams`.
- **5xx responses** no longer echo the underlying message; the correlation id
  ties the response to the logged stack trace.
- `type` URIs point at the error reference (`https://oppenheimer.dev/errors`),
  configurable per deployment with `ERROR_TYPE_BASE_URL`.
- `ApiProblemResponse` puts the schema in the OpenAPI document.
