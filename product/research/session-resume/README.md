# Idle sessions and coming back to them (2026-11-24)

The owner asked how "onorca" handles idle sessions before we built ours.
Two things were to be built: a stopped session restarting when it is opened,
and the runner stopping idle sessions by itself. Each is weighed here against
four products that do the same.

**onorca is Orca.** `onorca.dev` answers with a 307 to `orca.dev`. Orca
(Stably AI, MIT) is the agent IDE note 00 calls our closest analogue, and
`orca-bots.md` reads it too. It runs Claude Code, Codex and other CLIs in
parallel git worktrees, on the desktop, over SSH and in cloud VMs.

Orca's source was read at commit `4cf395d` (2026-11-24). Its paths below are
under `https://github.com/stablyai/orca/blob/main/`. Its docs and the other
products' pages were fetched the same day. A claim drawn from silence is
marked as inferred.

## 1. Orca: hibernation

Source: `docs/site/content/docs/agents/hibernation.mdx`, published as
<https://orca.dev/docs/agents/hibernation>.

**When an agent hibernates.** The feature is **off by default**, under
Settings → Experimental. When it is on, it pauses one agent terminal at a
time, and only when all of these hold:

- the agent is `done`;
- its tab is not on screen;
- no keystroke has arrived since the agent finished;
- the agent can be resumed (Claude, Codex, Gemini, OpenCode, Pi and more);
- it has been idle for the window;
- no phone is driving it;
- no orchestration dispatch is unsettled;
- no live subagent is attached.

**The window.** It is 30 minutes by default and can be set from 1 minute to
24 hours ("Hibernate after"). In the code it is
`agentHibernationIdleMs: 30 * 60 * 1000`, in
`src/shared/settings/default-global-settings.ts`. The clock starts at the
last `done`, and a keystroke, new output or coming back to the tab starts it
again.

**Coming back.** It resumes **when its tab is opened**: "There's nothing to
click; the resume happens as part of bringing the terminal back into the
foreground". Orca relaunches the CLI on its own conversation
(`claude --resume <id>`, `codex resume <id>`), with the command, arguments
and environment it captured. If the CLI cannot resume, you get a fresh prompt
and the transcript stays in Session History. Nothing resumes on hover: the
docs and the code are silent on it (inferred).

**How it shows.** The restored terminal prints a `--- session restored ---`
banner (`SessionRestoredBanner.tsx`).

**When it falls back to a button.** A restore the host defers (too many
agents running, the host under heavy load, a pause after a crash) shows an
overlay, "Sleeping — click to resume", with a Resume button. The overlay is
`spawn-deferred-sleep.ts`, and its copy is `TerminalSleepingPaneOverlay` in
`src/renderer/src/i18n/locales/en.json`.

**Other sleeps.**

- A whole worktree can be put to sleep from the sidebar, "With Descendants"
  if you choose (`docs/site/content/docs/model/worktrees.mdx`). Opening it
  wakes its agents (`src/main/runtime/workspaces/sleep/workspace-sleep-runtime.ts`).
- A cloud VM suspends and resumes through your own recipe. Opening its
  workspace holds the open until the VM is up, and the card reads "VM waking"
  ("Resuming the VM and reconnecting."), or "VM resume failed".
- The daemon Orca runs over SSH exits after 15 unused minutes, but never while
  a client, a terminal, a working agent or an automation is live
  (`src/shared/remote-runtime/orcad-lifecycle/orcad-idle-exit.ts`).

**Limits.** We found no limits for shared viewers and no cost caps. The one
limit is the cap on live agents per host.

## 2. Comparables

| | Idle window | What counts as activity | Coming back | What survives |
|---|---|---|---|---|
| [GitHub Codespaces](https://docs.github.com/en/codespaces/setting-your-user-preferences/setting-your-timeout-period-for-github-codespaces) | 30 min by default, 5 to 240, capped by org policy | typing, the mouse, terminal input and output; a shared port nobody uses does not count | opening the codespace (its name, `gh codespace code`, Connect in VS Code) [starts it](https://docs.github.com/en/codespaces/developing-in-a-codespace/stopping-and-starting-a-codespace) | saved files and terminal history; [not running processes](https://docs.github.com/en/codespaces/about-codespaces/understanding-the-codespace-lifecycle) |
| [Coder](https://coder.com/docs/user-guides/workspace-scheduling) | autostop, bumped 1 h by activity | an IDE, a web terminal or SSH connected, an agent reporting a task; the dashboard does not count | [`coder ssh` starts a stopped workspace](https://coder.com/docs/reference/cli/ssh) | [persistent resources](https://coder.com/docs/user-guides/workspace-lifecycle) |
| [Ona (formerly Gitpod)](https://ona.com/docs/ona/organizations/policies/environment-timeout) | 30 min by default; 30 min, 1 h, 3 h, 8 h or never | SSH, IDE input, a running agent session, `keep-alive`; not background processes, ports, files or CPU | not documented | not documented |

## 3. What this means for us

- **Opening resumes it; nothing short of opening does.** All four products
  bring a sleeping environment back when it is opened, and none on hover. A
  button is left for the case the platform refuses (Orca's capacity
  overlay). That is the owner's design: Restart becomes the fallback.
- **What stops is the process, and the conversation reopens.** This is
  Orca's model and already ours. A stopped session keeps its worktree,
  branch and transcript, and Restart reopens the conversation by id.
- **The narrow trigger is Orca's.** The hosting products stop a whole machine
  when nobody types. Orca, like us, stops only a finished agent that nobody
  is watching or typing into. Our rules come from its list: never `working`
  or `blocked`, never while attached, never with a live parent or child.
  Two rules are ours: never a kept session, and on a session's own
  `done`/`idle` state rather than Orca's `done` alone.
- **The window.** All four default to 30 minutes, but they suspend at no
  cost (a VM, or a pane resumed in place). Orca ships its own idle stop off.
  Our stop costs a relaunch, and the terminal comes back from the agent's
  transcript, not from its old screen. Note 10 set the same trade-off for
  VMs: pause after ten minutes, suspend to disk after two hours. We take
  **two hours**. That is past a meeting or a lunch, so stepping away does not
  lose the terminal, and short enough that a day's forgotten sessions are
  gone by evening; the leak that started this was 110 agents over ten days.
  `RUNNER_IDLE_STOP` sets any other window, or `off`.
- **A head start on hover is not needed.** On a real runner (the fleet run
  on 2026-11-24, five restarts), a restart took 167–251 ms from the request
  until the session read live, and 293–375 ms until the terminal's first
  frame. Claude Code itself drew its first frame 0.46–0.70 s after launch.
  With the console's polling, an open is back in about a second, or a few
  for a long transcript. That is too little to buy back with the risk a
  hover-wake carries: passing over a list could wake dozens of agents.

## 4. Sources

- Orca: <https://orca.dev/>, <https://orca.dev/docs/agents/hibernation>,
  <https://orca.dev/docs/ways-to-run>, <https://github.com/stablyai/orca>
  (commit `4cf395d`), <https://www.ycombinator.com/companies/stably-ai-orca>
- Codespaces: the timeout, lifecycle, stop-and-start and
  [retention](https://docs.github.com/en/codespaces/setting-your-user-preferences/configuring-automatic-deletion-of-your-codespaces)
  pages linked above
- Coder: scheduling, lifecycle and `coder ssh`, linked above
- Ona: [environment timeout](https://ona.com/docs/ona/organizations/policies/environment-timeout),
  [classic workspace lifecycle](https://ona.com/docs/classic/user/configure/workspaces/workspace-lifecycle)
