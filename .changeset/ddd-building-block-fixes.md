---
"@oppenheimer/backend-ddd": minor
---

Fix the building blocks: a command with an empty payload is accepted; an entity refuses an empty id, exposes `domainEvents` read-only and `setUpdatedAt()` defaults to now; `Guard.isEmpty` treats a whitespace-only string as empty and `lengthIsBetween` answers `false` for an empty value instead of throwing; `convertPropsToObject` walks the props instead of `structuredClone`-ing them, so nested value objects are unpacked and dates stay dates; exceptions are named after their class, export `GenericErrorCode`, and serialize `httpStatus` and only the name and message of their cause; `RequestContextService.run` returns the function's result.
