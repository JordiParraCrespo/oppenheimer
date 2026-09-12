# 05 — Screens

## Decided

- Sign-in: one button, Continue with GitHub.
- Sidebar: sessions with a state dot, name, age; New session on top;
  user at the bottom; hosts and accounts in a settings drawer.
- New session: chips for host, repo, branch, agent; a box for a name
  or first task; chips remember last choice. Runtime and lifetime chips
  arrive with the VM slice.
- Session: terminal full-bleed, tabs, thin status line with host,
  branch, account, state, measured echo latency; login URLs as a
  button; phone layout with a key bar.
- Settings drawer: hosts with the install command and an online dot.
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
