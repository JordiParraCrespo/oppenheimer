---
"@oppenheimer/api": patch
---

Two write races closed in the API.

- API tokens: the active-token limit is checked where the token is written
  (`insertWithinLimit`: count and insert in one transaction under a per-owner
  advisory lock), so two mints near the limit cannot both succeed. An
  IPv4-mapped IPv6 allowlist prefix (`::ffff:203.0.113.0/120`) is read in the
  mapped address's 128 bits and matches the IPv4 clients it names.
- Feature flags: every flag write and segment delete runs under one
  advisory lock (`FeatureFlagRepositoryPort.serialized`), so a toggle cannot
  save a stale copy of a targeting edit and a segment cannot be deleted while a
  flag starts targeting it. The change listener registers with
  `suppressErrors: false`, so a failed audit write or snapshot reload is retried
  by the outbox relay instead of being marked delivered.
