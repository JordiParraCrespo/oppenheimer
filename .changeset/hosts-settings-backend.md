---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/runner": minor
"@oppenheimer/backend-email": minor
"@oppenheimer/translations": minor
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
- `@oppenheimer/api`: heartbeats write `host_presence` and, only when the
  machine changed, `host_inventory`, with the change on the host's timeline;
  host responses carry `machine`, `vitals` and `network`;
  `GET /v1/hosts/{id}/timeline`. The network a runner connects from is
  recorded and placed with DB-IP Lite (`HOSTS_GEOIP_CITY_DB`,
  `HOSTS_GEOIP_ASN_DB`, the `ip_geolocation` capability); a move to another
  country or network operator emails the owner. A daily job purges networks
  unseen for 90 days and timeline entries past 180.
- `@oppenheimer/runner`: reports OS name, kernel, CPU model, memory, disk
  total, virtualization, cloud, time zone, boot time and service manager,
  and available memory on the heartbeat.
- `@oppenheimer/backend-email`: `sendHostNetworkChanged` and its template.
- `@oppenheimer/translations`: `emails.hostNetworkChanged`.
