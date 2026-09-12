# MVP design

In-depth design of the MVP defined in [`../07-mvp.md`](../07-mvp.md).
One document per area, in the order they unblock each other. Each
document opens with what is already decided in the research notes,
then the questions still open. Decisions made here are final for the
MVP; when one changes, update the document and add a line to the log
at the bottom of this file.

| # | Document | Covers |
|---|----------|--------|
| 00 | [Scope](00-scope.md) | The exact feature list, in and out, and the demo scene it must satisfy |
| 01 | [Protocol](01-protocol.md) | Messages between browser, control plane, and runner; PTY frames; tickets; events |
| 02 | [Runner](02-runner.md) | The Go binary: sessions, tmux, ring buffer, reconnect, screen manifests, libvirt, vsock, sleep, account volumes |
| 03 | [Control plane](03-control-plane.md) | Data model, API, relay, GitHub App, token minting, sleep scheduler |
| 04 | [Guest image](04-guest-image.md) | What is in the golden image, the guest agent, workspace layout, build and rollout |
| 05 | [Screens](05-screens.md) | Sign-in, sidebar, Create session, session view, settings drawer; components and states |
| 06 | [Step-one spike](06-step-one-spike.md) | Exactly what to build in week one and how the latency gate is measured |
| 07 | [Security checklist](07-security-checklist.md) | The findings from note 04 that the MVP must satisfy, as a checklist |

## Decision log

- 2026-09-12: directory created; documents seeded with decisions from
  the research notes and open questions.
