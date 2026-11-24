---
"@oppenheimer/runner": patch
---

Several runner processes on one host (the daemon and `runner sessions …`
on the host, several at once) no longer lose each other's work. A save of
the session map merges, under a lock across processes: it writes only the
sessions this process changed, so another process's new sessions stay, and
a session another process closed is not reopened by a stale copy. A store's
clone, fetches and worktrees are serialised across processes too, not only
inside one, and a deepen in another process is waited for like one here,
so two creates on one repository no longer fail in git.
