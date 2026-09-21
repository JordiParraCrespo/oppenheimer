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
| 07 | [MVP](07-mvp.md) | A personal workspace of sessions, each a KVM guest on the Hetzner host, each just a terminal; Codex first; hosted web control plane |
| 08 | [Reuse the GHA runner host](08-reuse-gha-runner.md) | The existing Go runner controller is most of the provisioner; what sessions add; libvirt first, Firecracker later; website and runners in different places over the tailnet |
| 09 | [GitHub App install](09-github-app-install.md) | Install the App, choose all or selected repositories; the installation is the access control; narrowed one-hour tokens per session |
| 10 | [Sleep, wake, and pricing](10-sleep-wake-and-pricing.md) | Suspend and hibernate tiers on libvirt and on AWS, GCP, Azure, Fly, Hetzner Cloud; what an AX42 host holds; sleeping sessions are free; pricing shape |
| 11 | [Workspace layout](11-workspace-layout.md) | One fixed place per repo (§1 superseded by `versions/mvp/10`: projects above repos, checkouts under sessions); three runtimes: Shared workspace VM, Clean VM, This machine (the Mac Studio with simulators) |
| 12 | [Lessons from Grok Bot](12-lessons-from-grok-bot.md) | A reconstructed desktop agent app: brokered descriptors with hints, resumable migration streams, recreate-with-data updates, disk pressure, epoch-guarded reconnects; what we do not take |
| 13 | [Lessons from herdr](13-lessons-from-herdr.md) | herdr's source read in full: where it puts the process boundary and what that costs, agent manifests as versioned data with priorities and guards, hooks over scraping; and a 340-line SSH web terminal as the list of what not to do |
| versions/mvp/ | [MVP design](versions/mvp/README.md) | In-depth design of the MVP, one document per area, with its own decision log |

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
- Note 04 first proposed one persistent home volume per target. After a
  review found that conflicted with running two accounts concurrently,
  notes 04, 06, and 07 now use one volume per account.
- Note 07 records the VM lifetime decision: pause while idle, resume on
  visit, destroy on close. The phase table in note 00 is superseded by
  the order of work in note 07.
- Note 07 chose Firecracker first. Note 08 replaced it with libvirt/KVM
  because an existing, hardened controller already runs that on the
  target host. Firecracker is now a later cold-start optimization.
- Notes 02 and 05 described Claude Code on the web's access model, where
  the user's OAuth grant reaches any repository the account can see and
  the App only adds webhooks. Note 09 chooses the stricter model: the
  App installation, with all or selected repositories, is the access
  control.
- Note 07's single "pause when idle" became note 10's three tiers,
  tuned to the real host (i7-6700, 64 GB, SATA SSD): pause in RAM after
  ten minutes, suspend to disk after two hours, hibernate after a day.
- Note 07 said a VM per session. Note 11 keeps that for Ephemeral
  sessions and makes Keep sessions worktrees inside one workspace VM per
  repo per host, so the worktree UX matches Orca and ten sessions on a
  repo share one clone, one setup, and one Docker daemon.
- Note 00 proposed Next.js for the web app. Note 07 §11 leaves the
  framework open with a recommendation for a Vite + React SPA; Next.js
  used as a client app is also fine. The firm point is only that the
  console is a real-time client, not a server-rendered site.
- Note 07's VM-based MVP is superseded by `versions/mvp/00-scope.md`: the MVP
  is Orca on the web without VMs, sessions directly on your own hosts,
  Claude Code first. The VM design is the slice after, not deleted.
- Sign-in was GitHub-only; it is now GitHub, Google, and email plus
  password on day one, with Connect GitHub as a separate step
  (`versions/mvp/00-scope.md`).
- Notes 00 and 07 and `versions/mvp/03-control-plane.md` said Hono plus
  Drizzle for the control plane. The code started from the Flama
  starter, so the control plane is NestJS plus TypeORM on Postgres, with
  Better Auth for identity. The modules and the data model are unchanged;
  only the framework is (`versions/mvp/03-control-plane.md`).
- The codebase keeps every app the starter ships (admin, mobile, CLI,
  MCP, showcases, Helm) from day one, so later slices need no porting.
  Only `api`, `web`, `runner`, `docs` and `e2e` are the MVP; the rest is
  carried, not built on, until its slice arrives (`AGENTS.md`).
- The personal workspace is a row in the starter's `organization` table
  with the account as its single owner member, created at sign-up. No
  roster, no invitations, no teams are exposed in the MVP
  (`versions/mvp/08-auth.md`).
- Signed self-update moved from `versions/mvp/00-scope.md`'s out-list
  into the MVP. What changed is *when*, not what: F26 always said signed
  updates the control plane cannot forge. Design in
  `versions/mvp/09-runner-install-and-update.md`; F26 is now on the 07
  checklist.
- Note 03 cited herdr from its website. Note 13 reads its source: the
  architecture matches ours, but herdr owns the PTYs, so its agents do not
  survive a restart. Our tmux layer is what buys that, at the cost of
  terminal fidelity — recorded as a trade, not a win.
- `versions/mvp/00-scope.md` and `05-screens.md` said onboarding was four
  screens ending on New session and a session was one repository. The
  version-1 frames, walked with the owner on 2026-09-19, changed both:
  onboarding names the workspace and lands on a Ready summary, and a
  session may span several repositories, one worktree each. Recorded in
  00, 05, 08 and the MVP decision log.
- Note 02's open question about screen manifests is answered by note 13:
  lifecycle hooks are authoritative where an agent has them, screen reading
  is the fallback, and rules carry a priority and negative guards rather than
  being a chain of ifs (`versions/mvp/02-runner.md` §9).
- The control-plane modules and data model *have* now changed, where the
  line above said only the framework had. `versions/mvp/10-api-modules-and-data-model.md`
  replaces note 03's seven modules and its first-cut table list with
  five modules — `hosts`, `github`, `projects`, `sessions`, `relay` —
  and eight tables, held to the shape of the starter's own Better Auth
  schema —
  flat rows, credentials inline with their subject, a table only where
  the lifetime is independent. `installations` and `repositories` merge
  into one aggregate;
  `tokens` becomes a port rather than a module because an installation
  token is never stored; `events` is a table inside `sessions`; `jobs`
  disappears because the outbox already is one. Models and coding agents
  get no table at all, and "GitHub allowed repositories" turns out to be
  the same noun as "repositories" — the App installation is a boundary
  GitHub already enforces.
- Note 11 said one worktree per session under
  `workspaces/<repo>/main`. `versions/mvp/10-api-modules-and-data-model.md`
  supersedes its §1: a **project** level sits above the repository, a
  session may check out **several** repositories, and those checkouts
  live under the session rather than under the repo. The store is a
  bare clone, always owner-prefixed, and every directory name is a
  database constraint instead of a convention. Note 11 §2 onward still
  stands.
- `versions/mvp/08-auth.md` said hosts belong to the workspace that
  paired them, then to a workspace and an owner. `versions/mvp/10` now
  makes a host the person's, borrowed by every workspace they are in,
  the way Better Auth hangs devices and logins off `user`; the on-disk
  layout gains a `workspaces/<org>/` level above `projects/`. Note 06's
  per-account config directories remain the answer to several logins on
  one machine, and remain a later slice.
- `versions/mvp/10` first mirrored every installation's repository set
  with webhooks and a resync. It now lists repositories live from GitHub
  and keeps a row only for repositories a session has checked out. Note
  09's "the installation is the access control" is unchanged; what
  changed is that we stopped keeping a copy of the list it controls.
- The same note then dropped the repository table entirely: a checkout
  carries GitHub's ids inline and the runner owns the store on disk.
  Seven new tables, not eight.
- `versions/mvp/05-screens.md` described a settings drawer holding
  hosts, and the console kept the starter's Settings and Profile pages
  underneath it. The version-1 frames draw neither, so the console is
  now one screen — sidebar plus pane — and both pages were deleted
  rather than hidden. The drawer is still the answer for hosts; it is a
  later slice, and it is a drawer, not a destination.
- `versions/mvp/10-api-modules-and-data-model.md` said a model was a
  launch option "recorded in the log, not a column". `versions/mvp/12-session-launch.md`
  makes the promotion that note said would be a replay: the New session
  screen sets a model, a permission level and an effort, and a restart,
  the engine button and the remembered last choice each read them per
  row, so the fold projects them onto `work_session`. "No table, no
  endpoint" is unchanged, and the flag strings each permission level maps
  to are catalog data beside `command`, not a column per agent.
