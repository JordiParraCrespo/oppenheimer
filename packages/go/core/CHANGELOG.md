# @oppenheimer/go-core

## 0.1.1

### Patch Changes

- 5744358: `make -C packages/go lint` passes the module directories one argument at a
  time.

  Unquoted, `$(go list -m -f '{{.Dir}}/...')` splits on the spaces in a checkout
  path, so on a machine whose repo lives under one, golangci-lint was handed
  half a path, reported "directory not found" for every module, and exited with
  `0 issues` — a run that linted nothing and either looked green or failed for a
  reason unrelated to the code. CI's own checkout has no spaces, so only local
  runs saw it.
