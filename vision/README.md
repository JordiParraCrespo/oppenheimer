# Vision

Everything discussed while planning the platform, in the order it was
decided. Read `brief.html` for the one-page version, or the notes below
for the detail and sources.

| # | Note | What it settles |
|---|------|-----------------|
| 00 | [Vision and plan](00-vision-and-plan.md) | What we build, lessons from OpenClaw and Orca, layers, domain model, stack |
| 01 | [Terminal first](01-terminal-first.md) | The core primitive is a persistent PTY in the browser; how Orca's relay does it; subscription logins done legitimately |
| 02 | [Targets and GitHub auth](02-targets-and-github-auth.md) | Direct-machine vs isolated-VM targets; proxy-injected GitHub tokens as Claude Code on the web does it |
| 03 | [Machines and VM provisioning](03-machines-and-vm-provisioning.md) | herdr, the Actions runner registration design, Actuated, the Firecracker provisioner, service split, Go runner |
| 04 | [Security review](04-security-review.md) | 28 findings by trust boundary, Tailscale as an optional perimeter, the measured reference VM spec |
| 05 | [GitHub experience](05-github-experience.md) | Connect, start, review, PR, auto-fix, routines, environments, and what each piece costs |
| 06 | [Multiple accounts](06-multi-account.md) | How Orca handles several Claude, Codex, Kimi, OpenCode accounts and usage meters; our account model; macOS resolved |
| 07 | [MVP](07-mvp.md) | A personal workspace of sessions, each a VM on a host you own, each just a terminal; Create session with host, repo, branch, agent |

Decisions that changed along the way, so nobody is confused by an
earlier note:

- Note 00 proposed the Claude Agent SDK as the core. Note 01 replaced it
  with a raw terminal; the SDK is a later add-on for unattended runs.
- Note 00 proposed a Node runner. Note 03 changed it to a single static
  Go binary.
- Note 06 first flagged the macOS Keychain as a blocker for multiple
  Claude accounts; it then verified that Claude Code 2.1.144+ scopes the
  Keychain entry per config dir, so it is not.
- Note 07 was first written as a five-screen MVP, then cut to sessions
  only on direct machines, then, after seeing the console mockups,
  reset to sessions in VMs with repo, branch, and agent chosen at
  creation. The session view stays a terminal; the Agent SDK stays out.
