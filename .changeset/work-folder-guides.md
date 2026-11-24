---
"@oppenheimer/runner": minor
---

Every level of the work folder carries a `README.md` and an `AGENTS.md`:
the root, each account, workspace, `repos.noindex/`, `sessions.noindex/`
and session folder. The README names the id-named folder (a workspace by
its slug, a session by its name) and lists what it holds; the AGENTS.md
tells an agent where its checkout is and what not to touch. The runner
rewrites them on every create and close and when it starts, and leaves a
file at that path it did not write. A session's marker also keeps its
name, agent, branch and checkouts.
