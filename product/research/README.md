# Research

Reads of other products, measurements, and proposals that were not
adopted. A note here decides nothing: when one leads to a decision, the
decision is written in the note that owns it (the numbered notes in
`../`, `../versions/mvp/` or `../next-steps/`), and the change is
logged in [`../README.md`](../README.md). Paths in backticks inside
these notes are relative to `product/`.

Notes 12, 13, 14 and 16 were numbered notes in `../` and are still
cited by those numbers elsewhere; the Formerly column below maps them.

## Reads and measurements

| Note | Formerly | What it is |
|------|----------|------------|
| [Lessons from Grok Bot](lessons-from-grok-bot.md) | note 12 | A reconstructed desktop agent app: brokered descriptors with hints, resumable migration streams, recreate-with-data updates, disk pressure, epoch-guarded reconnects; what we do not take |
| [Lessons from herdr](lessons-from-herdr.md) | note 13 | herdr's source read in full: where it puts the process boundary and what that costs, agent manifests as versioned data with priorities and guards, hooks over scraping; a 340-line SSH web terminal as the list of what not to do |
| [Session boot time, measured](session-boot-time.md) | note 14 | Each hop from Send to the agent's first byte, measured from the browser, beside how Orca prepares a checkout before the click; its questions are `versions/mvp/02` open question 9 and `05` open question 8 |
| [Developer-tools landscape](developer-tools-landscape.md) | note 16 | AI review, agent consoles, merge tools, analytics and sandboxes as of September 2026; ten things to take, feeding note 15 and `next-steps/0.2-pull-requests.md` |
| [Lessons from Synara and OpenClaw](lessons-from-synara-and-openclaw.md) | PR #51 | Neither renders a terminal: both drive Claude Code and Codex through stream-json or `codex app-server` and draw typed events as cards with paced deltas; the cost is process survival, which is why we keep tmux. Input for `next-steps/0.7-terminal-and-chat.md` |
| [Orca in the browser, and agent logins across hosts](orca-web-auth-and-cross-host-logins.md) | PR #49 | Orca pairs a browser to its runtime with a link the machine mints and shares no agent login across hosts, though on one host it captures and refreshes tokens itself; the vendors' rules; ours stays per host with no credential held (note 01 §7, note 06, F23) |
| [Lessons from DigitalOcean Managed Agents](lessons-from-digitalocean-managed-agents.md) | PR #43 | Firecracker agent sessions as a service, read from `doctl`, `godo` and `pydo`; what is worth taking for the layer above a VM, and why a platform-held API key rules it out as our runtime |

## Proposals not adopted

Kept as the research and reasoning behind them. Each opens with the note
that governs today.

| Note | Formerly | What it proposed |
|------|----------|------------------|
| [Ephemeral cloud machines](ephemeral-cloud-machines.md) | PR #43, note 14 | One lifecycle port over AWS EC2, Oracle Cloud and Alibaba ECS: a cloud machine is a host that pairs itself; provider facts, prices and quotas as of 2026-09-22 |
| [Sessions in microVMs](sessions-in-microvms.md) | PR #43, note 15 | A session as a Firecracker microVM on a KVM host, with the lifecycle Claude Code on the web uses: two states instead of three sleep tiers, no NIC, vsock to the host |
| [Orchestration draft](orchestration-draft.md) | PR #43, `versions/mvp/17` | One runner per host, many hosts per person, placement as a ladder, machine jobs on BullMQ, the transcript snapshot, the sweeper |
| [Headless runs draft](headless-runs-draft.md) | PR #43, `versions/mvp/18` | A run as a session whose window 0 is `claude -p` with stream-json; governed now by `versions/mvp/16-automations-architecture.md`, which built on it |

`packages/backend/machines`, the provider SDK that came with the cloud
proposals in #43, was not carried over: nothing in the API uses it, the
review placed provider adapters inside `hosts/` rather than in a package,
and VMs are not yet placed after the MVP. It stays on that pull
request's branch, `claude/affectionate-curie-s2ke6p`.
