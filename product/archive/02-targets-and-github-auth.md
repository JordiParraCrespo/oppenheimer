# 02 — Two kinds of target, and GitHub auth the Claude-Code-on-the-web way

## 1. Two target modes

A target is any machine the runner daemon is installed on. It comes in two
modes, chosen when the target is registered, and a project may use both.

### Mode A: direct machine (full access)

- The runner runs as your user on a machine you already own: laptop,
  Mac Studio, a bare server. Sessions are PTYs on that machine, in a
  worktree under a path you choose.
- No isolation beyond git worktrees. The agent sees your home, your
  toolchains, your docker socket, your logged-in CLIs. This is what Orca
  gives you over SSH, and it is the right default for a machine that is
  yours and only yours.
- Local or remote makes no difference to the platform: the runner dials
  out either way. "Local" just means the browser and the runner are on
  the same box.
- Install: one command that downloads the runner and embeds the target
  token. On macOS it registers a launchd agent, on Linux a systemd user
  unit, so it survives reboots.

### Mode B: isolated VM (provisioned per task)

- The runner runs on a host with a hypervisor and acts as a VM
  provisioner. Each task gets a fresh VM with a fixed budget, 4 to 8 GB
  RAM and 2 to 4 vCPUs to start, a disk image with Docker preinstalled,
  and the repo cloned at the requested branch.
- The task's setup script runs inside the VM (install deps, start
  services with docker compose), then the PTY is opened inside the VM.
  The runner on the host proxies PTY bytes and files between the VM and
  the control plane. The VM itself has no platform credentials.
- Docker inside the VM is the point: the agent can bring up Postgres or
  Redis for the task without touching the host.
- Lifecycle: VM is created on session start, paused after idle timeout,
  destroyed after the retention window or when the session is closed.
  Home directory for CLI logins is a persistent per-target volume that is
  attached to each VM (see 01 §7), so `claude` stays logged in across
  fresh VMs.

Hypervisor per host OS:

| Host | Mechanism | Notes |
|------|-----------|-------|
| Linux | Firecracker microVM (or Cloud Hypervisor) | sub-second boot, rootfs from a prebuilt image, this is what Anthropic-style sandboxes use |
| Linux, simpler | QEMU/KVM via libvirt | slower boot, more compatible, fine for MVP |
| macOS | Apple Virtualization.framework (via `tart` or `lume`) | Apple silicon, Linux guests, near-native speed |
| Cloud | provider API (Hetzner, Fly Machines, EC2) | the runner is a control-plane adapter, not a daemon on the host |

MVP recommendation: mode A on day one (it is the terminal from note 01),
mode B in the phase after secrets, starting with Linux + Firecracker
because it is the best-documented path and the images are reusable for
the cloud adapter later. macOS VM hosting comes after.

Both modes present the same thing to the browser: a session with a PTY,
a file tree, a diff, and a git remote. The mode only changes what the
runner does before it opens the PTY.

## 2. GitHub auth: copy Claude Code on the web

What Claude Code on the web does, verified from inside one of its
sandboxes and from the docs:

1. **Authorization, once, in the browser.** The user authorizes the
   Claude GitHub App (or syncs a `gh` token with `/web-setup`). The
   platform now holds a user-level GitHub credential server-side. A
   session can reach any repo that GitHub account can see; installing
   the App on a repo only enables PR webhooks for auto-fix.
2. **The sandbox never holds the token.** Inside the VM the environment
   contains `GITHUB_TOKEN=proxy-injected` and `GH_TOKEN=proxy-injected`,
   placeholder strings. Git is configured with `http.proxyauthmethod`
   and `GIT_SSL_CAINFO` pointing at a platform CA bundle.
3. **A credential-injecting egress proxy.** All HTTPS from the sandbox
   goes through a local proxy that tunnels to a policy-enforcing egress
   proxy. TLS is re-terminated there with the platform CA, the request
   to `github.com` or `api.github.com` gets the real, session-scoped
   token attached, and the response comes back. `git@github.com:` SSH
   remotes are rewritten to HTTPS so they take the same path.
4. **Scoping happens at the proxy.** The proxy knows which session is
   asking and which repos that session was granted, so a token for repo
   A cannot be used for repo B even if the agent tries. Adding a repo
   mid-session (`add_repo`) is a control-plane call that widens the
   proxy's allowlist for that session, not a new token in the VM.
5. **Same trick for other credentials.** API keys added to the cloud
   environment are also attached at the proxy after the request leaves
   the session. The pattern generalizes: the sandbox sees placeholders,
   the proxy sees secrets.
6. **Network policy lives in the same proxy.** Egress allowlists
   (trusted, limited, none) are enforced there, with 403/407 for
   blocked hosts.

Why this is the right model for us:

- The agent, and any code it runs, cannot exfiltrate a GitHub token
  because there is none to exfiltrate. This is the strongest possible
  answer to "an agent ran `env` and pasted it somewhere".
- Push, clone, and API calls work with unmodified `git` and `gh`. No
  credential helper hacks, no PAT copying, no per-machine SSH keys.
- One user authorization covers every target and every VM.

### How it maps onto our two modes

**Mode B (VM)** gets the full copy: the runner on the host runs the
egress proxy, the VM's default route and `HTTPS_PROXY` point at it, the
platform CA is baked into the image, and the control plane hands the
runner a short-lived, repo-scoped GitHub token per session (a GitHub App
installation token if we go the App route, which is repo-scoped and
expires in one hour by design).

**Mode A (direct machine)** is your machine, so exfiltration is not the
threat, but convenience still is. Options, in order of preference:

1. Same proxy, opt-in per session: the runner starts a local proxy and
   sets `HTTPS_PROXY`, `GIT_SSL_CAINFO` and the placeholder env vars only
   for the session's shell. Works with `git` and `gh` unmodified, and
   nothing is written to disk.
2. A git credential helper installed by the runner that asks the runner
   over its Unix socket for a fresh scoped token on each git operation.
   No proxy, no CA, but `gh` needs `GH_TOKEN` set separately.
3. Do nothing: the machine already has the user's own `gh` login. Also
   fine for a personal box.

### What the platform needs to build

| Piece | Where | Effort |
|-------|-------|--------|
| GitHub App (or OAuth app) + install flow in the web UI | control plane | small, well documented |
| Token minting: installation token scoped to the session's repos, 1h TTL, refreshed by the runner | control plane | small |
| Egress proxy with TLS re-termination, per-session allowlist, header injection for github.com | runner | medium, and the core security piece; use an existing MITM proxy library, do not write TLS code |
| CA bundle generation per install, baked into VM images, exported to the direct-mode shell | runner | small |
| `add_repo`-style call to widen a session's scope | control plane + UI | small |
| PR webhooks from the App into the session event log (auto-fix later) | control plane | medium, later |

### Open question

GitHub App versus OAuth App. The App gives us installation tokens that
are repo-scoped and short-lived, plus webhooks, and it is what Claude Code
uses. The OAuth route gives broader user-scoped tokens with less setup.
Recommendation: GitHub App, because scoping at mint time plus scoping at
the proxy is defense in depth, and the webhooks are needed for triggers
in phase 7 anyway.

## Sources

- Claude Code on the web, GitHub authentication and security sections:
  <https://code.claude.com/docs/en/claude-code-on-the-web>
- Cloud environments (network access levels, setup scripts, API credentials):
  <https://code.claude.com/docs/en/cloud-environments>
- Observed inside an Anthropic-hosted sandbox: `GITHUB_TOKEN=proxy-injected`,
  `HTTPS_PROXY` to a local agent proxy, `GIT_SSL_CAINFO` to a platform CA
  bundle, SSH remotes rewritten to HTTPS.
