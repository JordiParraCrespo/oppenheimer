# @oppenheimer/go-selfupdate — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first, then
> [`.agents/rules/go.md`](../../../.agents/rules/go.md) for the rules this
> module is written under, [`packages/go/README.md`](../README.md) for how
> the Go modules fit together, and
> [`product/versions/mvp/09-runner-install-and-update.md`](../../../product/versions/mvp/09-runner-install-and-update.md)
> for the design it implements.

## Rules that are not style

- **Verify, then parse.** `ParseManifest` checks the signature over the raw
  bytes before it decodes them. Never add a code path that reads a field out
  of an unverified document, not even to log it.
- **Nothing unverified survives on disk.** Every failure path deletes what it
  wrote. A half-written binary in the layout is the failure mode this module
  exists to prevent.
- **No policy here.** Channels, safe windows, health gates and rollback
  decisions belong to the service. This module offers the mechanics and stays
  usable by a second binary.
- **No new dependencies.** `crypto/ed25519`, `archive/tar` and `net/http` are
  the whole toolbox; the signing side is `openssl`, which every release
  machine already has.

## Before pushing

```bash
pnpm --filter @oppenheimer/go-selfupdate lint
pnpm --filter @oppenheimer/go-selfupdate test
pnpm --filter @oppenheimer/runner test    # the boundary test still passes
```
