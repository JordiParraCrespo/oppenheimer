# Archive

The planning notes written before the MVP was scoped, in September 2026.
They are the reasoning behind today's design, not its description: much of
what they settled (VMs per session, Firecracker, Hono and Drizzle, a
Codex-first MVP) was replaced, and [`../decisions.md`](../decisions.md),
"Across the product", says by what.

What the design still builds on: `security-review.md`'s findings are where the
[security checklist](../design/foundations/security-checklist.md) comes
from, and `machines-and-vm-provisioning.md`, `reuse-gha-runner.md` and `sleep-wake-and-pricing.md` are the starting point of the VM slice when it
comes back.

| Note | What it settles |
|------|-----------------|
| [Vision and plan](vision-and-plan.md) | What we build, lessons from OpenClaw and Orca, layers, domain model, stack |
| [Terminal first](terminal-first.md) | The core primitive is a persistent PTY in the browser; how Orca's relay does it; subscription logins done legitimately |
| [Targets and GitHub auth](targets-and-github-auth.md) | Direct-machine vs isolated-VM targets; proxy-injected GitHub tokens as Claude Code on the web does it |
| [Machines and VM provisioning](machines-and-vm-provisioning.md) | herdr, the Actions runner registration design, Actuated, the Firecracker provisioner, service split, Go runner |
| [Security review](security-review.md) | 28 findings by trust boundary, Tailscale as an optional perimeter, the measured reference VM spec |
| [GitHub experience](github-experience.md) | Connect, start, review, PR, auto-fix, routines, environments, and what each piece costs |
| [Multiple accounts](multi-account.md) | How Orca handles several Claude, Codex, Kimi, OpenCode accounts and usage meters; our account model; macOS resolved |
| [MVP](mvp.md) | A personal workspace of sessions, each a KVM guest on the Hetzner host, each just a terminal; Codex first; hosted web control plane; superseded by [`../design/foundations/scope.md`](../design/foundations/scope.md) |
| [Reuse the GHA runner host](reuse-gha-runner.md) | The existing Go runner controller is most of the provisioner; what sessions add; libvirt first, Firecracker later; website and runners in different places over the tailnet |
| [GitHub App install](github-app-install.md) | Install the App, choose all or selected repositories; the installation is the access control; narrowed one-hour tokens per session |
| [Sleep, wake, and pricing](sleep-wake-and-pricing.md) | Suspend and hibernate tiers on libvirt and on AWS, GCP, Azure, Fly, Hetzner Cloud; what an AX42 host holds; sleeping sessions are free; pricing shape |
| [Workspace layout](workspace-layout.md) | One fixed place per repo (§1 superseded by `../design/foundations/api-modules-and-data-model.md`: one store per repo per workspace, checkouts under sessions); three runtimes: Shared workspace VM, Clean VM, This machine (the Mac Studio with simulators) |

The reads and measurements written in the same series (Grok Bot, herdr,
session boot time, reviewing at agent speed, the developer-tools landscape)
are in [`../research/`](../research/README.md).
