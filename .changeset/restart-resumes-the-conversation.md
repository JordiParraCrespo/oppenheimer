---
"@oppenheimer/api": patch
"@oppenheimer/runner": patch
"@oppenheimer/shared": patch
"@oppenheimer/web": patch
"@oppenheimer/translations": patch
---

Restart brings a session back where it left off, and the stopped pane says so.

A restart recreated window 0 and started the agent from nothing, replaying the
first task — so the conversation was lost and the work asked for twice. Now
that a session names the agent's own conversation, a restart reopens it
instead: same worktree, same branch, the whole exchange back, and no prompt
re-sent because the conversation already holds it. Grok joins Claude Code;
Codex and OpenCode can only resume an id they chose themselves, so they keep
restarting the way they did.

The pane that said "This session has stopped. Its work is on its branch" now
names the branch, says restarting brings the terminal back where it left off,
and leads with **Restart**. A deleted session has no worktree to return to, so
it is offered nothing.
