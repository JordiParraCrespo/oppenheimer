# 05 — Screens

## Decided

- Sign-in: GitHub, Google, or email and password. Connect GitHub (the
  App install) is its own step after sign-in.
- Onboarding, four screens, shown once: sign in; connect GitHub, all
  or selected repos, skippable but the repo chip stays empty until
  done; add a host, with two buttons, Copy install command and Copy
  prompt for an AI agent, both carrying the same one-hour token, the
  screen flipping to online when the runner registers; create your
  first session, which is the real New session screen with chips
  prefilled (the host just added, the first repo of the installation,
  its default branch, Claude Code) and a box for a name or first task.
  Missing pieces are handled inline afterwards: no `claude` login
  becomes the login URL button in the terminal; no `tmux` is caught at
  the add-host step.
- Sidebar: sessions with a state dot, name, age; New session on top;
  user at the bottom; hosts and accounts in a settings drawer.
- New session: chips for host, repo, branch, agent; a box for a name
  or first task; chips remember last choice. Runtime and lifetime chips
  arrive with the VM slice.
- Session: terminal full-bleed, tabs (tmux windows, window 0 the
  agent, the rest shells in the same worktree), thin status line with host,
  branch, account, state, measured echo latency; login URLs as a
  button; phone layout with a key bar.
- Settings drawer: hosts with the install command, the agent prompt,
  an online dot, and the preflight result (git, tmux, claude).
  Accounts arrive with the accounts slice.
- Web framework open: Vite SPA recommended, Next.js as a client app
  acceptable. Decide at step 3.

## Open questions

1. Session naming: user-typed, derived from the first task, or from the
   branch? Sidebar shows which?
2. State dot colors and what "blocked" looks like on the card: a dot,
   a badge, or the last line of output?
3. Phone key bar contents: Esc, Tab, Ctrl, arrows, paste. Anything
   else?
4. Where do usage meters go later, so the status line leaves room?
5. Dark only, like the mockups, or both themes?
