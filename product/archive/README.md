# Archive

The planning notes written before the MVP was scoped, in September 2026.
They are the reasoning behind today's design, not its description: much of
what they settled (VMs per session, Firecracker, Hono and Drizzle, a
Codex-first MVP) was replaced, and [`../decisions.md`](../decisions.md),
"Across the product", says by what. They are still cited by number:
"note 04", with the word, is a note here.

What the design still builds on: note 04's findings are where the
[security checklist](../design/foundations/07-security-checklist.md) comes
from, and notes 03, 08 and 10 are the starting point of the VM slice when it
comes back.

| # | Note | What it settles |
|---|------|-----------------|
| 00 | [Vision and plan](00-vision-and-plan.md) | What we build, lessons from OpenClaw and Orca, layers, domain model, stack |
| 01 | [Terminal first](01-terminal-first.md) | The core primitive is a persistent PTY in the browser; how Orca's relay does it; subscription logins done legitimately |
| 02 | [Targets and GitHub auth](02-targets-and-github-auth.md) | Direct-machine vs isolated-VM targets; proxy-injected GitHub tokens as Claude Code on the web does it |
| 03 | [Machines and VM provisioning](03-machines-and-vm-provisioning.md) | herdr, the Actions runner registration design, Actuated, the Firecracker provisioner, service split, Go runner |
| 04 | [Security review](04-security-review.md) | 28 findings by trust boundary, Tailscale as an optional perimeter, the measured reference VM spec |
| 05 | [GitHub experience](05-github-experience.md) | Connect, start, review, PR, auto-fix, routines, environments, and what each piece costs |
| 06 | [Multiple accounts](06-multi-account.md) | How Orca handles several Claude, Codex, Kimi, OpenCode accounts and usage meters; our account model; macOS resolved |
| 07 | [MVP](07-mvp.md) | A personal workspace of sessions, each a KVM guest on the Hetzner host, each just a terminal; Codex first; hosted web control plane; superseded by [`../design/foundations/00-scope.md`](../design/foundations/00-scope.md) |
| 08 | [Reuse the GHA runner host](08-reuse-gha-runner.md) | The existing Go runner controller is most of the provisioner; what sessions add; libvirt first, Firecracker later; website and runners in different places over the tailnet |
| 09 | [GitHub App install](09-github-app-install.md) | Install the App, choose all or selected repositories; the installation is the access control; narrowed one-hour tokens per session |
| 10 | [Sleep, wake, and pricing](10-sleep-wake-and-pricing.md) | Suspend and hibernate tiers on libvirt and on AWS, GCP, Azure, Fly, Hetzner Cloud; what an AX42 host holds; sleeping sessions are free; pricing shape |
| 11 | [Workspace layout](11-workspace-layout.md) | One fixed place per repo (§1 superseded by `../design/foundations/10-api-modules-and-data-model.md`: one store per repo per workspace, checkouts under sessions); three runtimes: Shared workspace VM, Clean VM, This machine (the Mac Studio with simulators) |

Notes 12 to 16 were moved to [`../research/`](../research/README.md); its
Formerly column maps their numbers.
