---
"@oppenheimer/backend-core": minor
---

Remove the starter's unused exports and add the helpers the API repeated by hand.

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
