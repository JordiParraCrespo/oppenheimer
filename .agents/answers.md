# Answers the user already gave

Read this before asking the user anything. If a line here answers the
question, apply it and say which line you applied; ask only when the
situation differs from what the line covers, and say how.

When the user answers a question that could come up again, add a line in
the pull request the task opens, or in a one-line `ship` pull request of
its own when the task opens none. Keep the user's meaning and the source;
a later answer replaces the line it contradicts, with the new date.

Product decisions (what the product does) live in `product/README.md`,
"decisions that changed"; this file holds how the work is done.

| Date | Question | Answer | Source |
| --- | --- | --- | --- |
| 2026-11-09 | Keep the user's preferences in a personal `-mode` skill? | No. Each lesson goes into the skill that owns that moment. | JordiParraCrespo/oppenheimer#779 (closed) |
| 2026-11-10 | Name the user in the agent instructions (`.agents/`, `AGENTS.md`)? | No. Say "the user". | this file's pull request |
| 2026-11-10 | Keep `automate-me`? | Not for now; removed. | this file's pull request |
| 2026-11-09 | Ask the same question twice? | Never. Answers are recorded here. | this file's pull request |
| 2026-11-11 | With no default repositories, how does a GitHub trigger added before any is picked work? | No default project or repository; the card listens on all picked repositories once Where it runs picks them. | this file's pull request |
| 2026-11-14 | What are the "tracks" a bot subscribes to on the plan? | Not a separate concept: the user wants bots to subscribe to events on a project's tasks (a status move and the rest, each a kind of event). Built as project and milestone watches with a chosen list of task events; the default is status changes plus blocked and unblocked. | this file's pull request |
