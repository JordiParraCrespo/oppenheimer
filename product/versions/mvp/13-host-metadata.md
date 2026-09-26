# Host metadata: the data model

12 asked for more about each host: where it connects from, what the machine
is, how it is doing. This note is where that data lives. The rule behind
it is the one a large fleet teaches: **store each fact by how often it
changes and who reads it**, never by which noun it happens to describe.
The schema is `apps/api/src/migrations/1789700000000-AddHostInventoryAndPresence.ts`.

## The problem with one row

`host` held four kinds of fact at four rates:

| Fact | Changes | Read by |
|---|---|---|
| Identity: owner, name, key | at pairing, on rename, on rotation | every assertion check, every list |
| What the machine is: OS, CPU, tools, runner version | on boot, on install, on upgrade | Settings, New session's agent chip, rollout |
| Whether it is there: last heartbeat, live load | every 15 seconds | every list (`online`) |
| Where it connects from | on connect | Settings, the new-network notice |

The heartbeat rewrote the whole ~1 KB row, key and full inventory included,
to move one timestamp. Because the inventory carried free disk, it changed
on every beat, so "the machine changed" could not be told from "a heartbeat
arrived", and there was no history of either.

## Four tables

```
host (identity; unchanged, loses its metadata columns in the contract step)
 ├── host_inventory   1:1   what the machine is      written when factsHash changes
 ├── host_presence    1:1   is it there, live nums   written every heartbeat
 │        └── currentNetworkId ──┐
 ├── host_network     1:N   public addresses seen    written on connect
 └── host_event       1:N   what changed, when       appended on change
```

- **`host_inventory`**: one row per host, keyed by it. The API hashes the
  canonical *static* facts (live numbers excluded) and the upsert only
  writes when the hash differs: `ON CONFLICT DO UPDATE … WHERE "factsHash"
  IS DISTINCT FROM`. A repeat report locks the row and writes nothing. The
  fields a screen shows or a rollout counts are columns: `osName`,
  `kernelVersion`, `cpuModel`, `cpuCount`, `memoryTotalBytes`,
  `diskTotalBytes`, `virtualization`, `cloudProvider`, `timezone`,
  `bootedAt`, `runnerVersion`, `channel`, `serviceManager`. The whole report
  is kept in `facts`, so a field a newer runner sends is stored before
  anything promotes it. Values the runner defines have **no CHECK**: a runner
  newer than the control plane may send a word this schema has never seen,
  and a refused insert would lose the whole report. `platform` is the
  exception, because the shared schema already closes it.
- **`host_presence`**: one narrow row (≈90 bytes) per host that has ever
  connected: `lastSeenAt`, `connectedAt`, the link's round trip, one-minute
  load, available memory, free disk, and the current network. Nothing a
  heartbeat writes is indexed and the table is `fillfactor = 70`, so a beat
  is one small HOT update. `online` is still derived from `lastSeenAt` on
  read, never stored.
- **`host_network`**: one row per distinct public address a host has used,
  with the geography resolved then (country, region, city, ASN and its
  organisation), and first and last seen. It is a dimension, not a log:
  it grows with the places a machine actually goes, not with time.
  "Is this a new network for optimus?" is one probe on
  `UQ_host_network_host_ip`. The address is the one this process saw on the
  link, **never one the runner reports**. Private, LAN and VPN addresses are
  not collected (12).
- **`host_event`**: append-only; `bigint` identity key, so inserts go to the
  end of the index. Kinds: `paired`, `renamed`, `unpaired`,
  `facts_changed` (with the diff), `network_changed`, `runner_updated`,
  `runner_rolled_back`. It is the timeline on a host's detail and the record
  09 §5 needs for "last update outcome, rollback included".

Every table cascades from `host`. Hosts are only hard-deleted when their
owner's account is, and then nothing about the machine should survive. None
of them carries `ownerUserId`: they are only read through a host already
loaded under the caller's scope.

## Access patterns

| # | Query | Served by | Proven |
|---|---|---|---|
| Q1 | A person's hosts with presence, inventory, region | `IDX_host_owner` → three PK lookups | yes |
| Q2 | One host, the same | the PKs | by Q1 |
| Q3 | Heartbeat | `PK_host_presence`, HOT | yes, 100% HOT |
| Q4 | Facts upsert, no-op on unchanged hash | `PK_host_inventory` conflict arbiter | yes |
| Q5 | Has this host used this address? | `UQ_host_network_host_ip` | yes |
| Q6 | A host's timeline, newest first, keyset | `IDX_host_event_host_occurred`, scanned backwards | yes, no Sort |
| Q7 | Retention: networks unseen 90 days, not current | `IDX_host_network_last_seen` + `IDX_host_presence_current_network` | yes |
| Q8 | Retention: events past 180 days | `IDX_host_event_occurred_brin` | yes |

"Proven" means `check-migration.mjs` ran on Postgres 16 with 20,000 hosts
over 2,000 owners. It ran `up`, `down`, `up`, backfilled real `host` rows,
and refused a bad event kind, a duplicate address, a lower-case country code
and a malformed hash. Q1 sorts the owner's rows by `createdAt` after
`IDX_host_owner`. That is a handful of rows per person and was already the
case.

Measured with 20,000 single-row heartbeats, each committed on its own:

| | Row | WAL per heartbeat | HOT |
|---|---|---|---|
| Today (`host`) | 1,080 B | 558 B | 97% |
| `host_presence` | 90 B | 242 B | 100% |

The saving is width and WAL (2.3× less per beat, which is the replication
and backup volume), plus no longer rewriting the inventory at all. Both
shapes stay HOT, because none of the columns the old writer touched is
indexed either.

## Retention

- `host_network`: 90 days after last use, except a host's current network.
  An IP address is personal data. The history of where a laptop has been is
  kept only as long as the new-network check needs it.
- `host_event`: 180 days, in batches of 5,000 through the BRIN.
- `host_presence` and `host_inventory`: one row per host, bounded.

Both deletes run from one scheduled job. Neither table is near the volume
where partitioning pays; the header says when it would.

## Deliberately not here

- **Heartbeat history.** Keeping every 15-second sample of every host in the
  transactional database is how an OLTP store becomes a bad time-series
  store. Presence keeps the latest values only. A history, if a screen ever
  wants a chart, is a metrics backend's job, fed from the relay.
- **`ownerUserId` on the child tables.** Everything is read through a scoped
  host, and a second owner column is a second truth.
- **A table per tool.** `tools` stays a jsonb list on the inventory. Nothing
  filters hosts by tool version today, and the agent chip reads the list
  whole.

## Rollout: expand, switch, contract

1. **Expand (this migration).** The four tables are created and the `host`
   rows backfilled: inventory from `capabilities`, presence from
   `lastSeenAt`. The old columns stay and are still written.
2. **Switch (next change).**
   - `HostPresenceResolver` writes presence on every beat and the inventory
     upsert on every report.
   - The relay records the network on connect: the socket's address, behind
     `TRUST_PROXY`, and the geography from a bundled offline IP database.
   - `hosts/` appends events on pair, rename, unpair and a facts or network
     change.
   - The host read joins the three tables.
   - The runner sends the new facts: OS name, kernel, CPU model, memory and
     disk totals, virtualization and cloud read from local DMI data (no
     metadata call), time zone, boot time, channel and service manager. Its
     heartbeat also carries load and available memory. Every new field is
     optional, as `cpus` was.
3. **Contract (a later migration).** Drop `hostname`, `os`, `arch`,
   `runnerVersion`, `capabilities` and `lastSeenAt` from `host` once nothing
   reads them.

## Open questions

1. **Which IP database.** MaxMind GeoLite2 needs an account and a licence
   key per deployment; DB-IP Lite is CC BY 4.0 and needs neither. Ship
   DB-IP in the image and let a deployment point at MaxMind?
2. **A new-network notice.** 12 proposed it. Email the owner on the first
   connect from a network the host has never used, as pairing already does,
   or only show it in the timeline? Email on a laptop that roams between
   cafés is noise; perhaps only when the country or ASN changes too.
3. **Round trip across replicas.** `roundTripMillis` is written by the
   replica holding the link, with the heartbeat, so it is always the true
   one. It goes stale with `lastSeenAt` and needs no extra rule. Recorded
   here so nobody adds a second writer.
