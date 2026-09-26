---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/runner": minor
---

The hosts backend for the Settings page (`product/versions/mvp/12-hosts-settings.md`).

- `@oppenheimer/api`: a host read carries a derived `status` (`running`, `idle`,
  `offline`, `unpaired`) and `runningSessionCount`, counted by `sessions/`
  through `HostsModule.contributeUsage`. `GET /v1/hosts` leaves unpaired hosts
  out unless `include=unpaired`. Removing a host, from either end, stops the
  sessions running on it. New `GET /v1/hosts/pairing/{id}` returns the token and
  the host it paired, for Add host's "Listening for this host…".
- `@oppenheimer/shared`: `HOST_STATUSES`, `listHostsQuerySchema`, and an
  optional `cpus` on the host facts, on both Zod entry points.
- `@oppenheimer/api-client`: regenerated; `getPairingToken`,
  `PairingTokenStatusResponseDto`, `HostStatus`.
- `@oppenheimer/runner`: the facts report the logical CPU count as `cpus`.
- `@oppenheimer/api`: host metadata tables (`host_inventory`, `host_presence`,
  `host_network`, `host_event`), backfilled from `host`; the old columns stay
  until the code switches over (`product/versions/mvp/13-host-metadata.md`).
