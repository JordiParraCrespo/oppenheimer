---
"@oppenheimer/shared": minor
"@oppenheimer/runner": patch
"@oppenheimer/api": patch
---

Generate the runner's link protocol from the shared schema instead of keeping a hand-written Go twin. Wire-neutral: the same bytes on the wire before and after.

- Shared: `RUNNER_LINK_REFUSAL_HEADER`, `RUNNER_LINK_REFUSALS`, `LINK_FRAME_HEADER_BYTES` and `ATTACHMENT_CREDIT_WINDOW_BYTES` join the close codes in `protocol/link.ts`, and the schema artifact carries every link constant under `x-constants`. The build also writes `protocol-schema/samples.json` (one message of every type, from the build-only `src/protocol/samples.ts`) and, through the new `scripts/emit-link-protocol.cjs`, `apps/runner/internal/link/protocol.gen.go`. Requiring an emitter no longer rewrites its output, so the committed-file specs can fail; `check:generated` runs every emitter's `--check`.
- Runner: `link/protocol.go` keeps only what is not wire shape; the structs, the type names and the constants are generated. `link/protocol_test.go` decodes every TypeScript sample with `DisallowUnknownFields`, holds each struct and the host's `Facts`/`Tool` to the schema, and checks the constants and gofmt. The lifecycle commands decode into their own messages rather than one merged struct. The package now declares `@oppenheimer/shared`, so a shared-only change runs the Go job.
- API: the refusal header, the `host-unpaired` refusal and the frame header width come from `@oppenheimer/shared/protocol`.
