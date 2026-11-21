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
| 2026-11-15 | One pull request, or several for work too large to review at once? | Stacked pull requests from now on: each layer based on the one below, one thing each. The steward skill, "Stacked pull requests", says how. | JordiParraCrespo/oppenheimer#869, the user's message after it |
| 2026-11-15 | In a sandbox whose network blocks Docker Hub and the Go toolchain, push when every other `ci:local` step is green? | Yes: push and open the pull request, the red rows explained as the sandbox's, showcase screenshots standing in for the console's. | this file's pull request |
| 2026-11-16 | Mimic another app's UI: copy its (permissively licensed) code with its notice, or rebuild the look? | Rebuild the look in our own code, from screenshots; copy none of its code, and name the source app nowhere (code, notices, commits, pull requests). | this file's pull request |
| 2026-11-17 | How should a composer (New session, bots, a session's chat) look while dictating? | Like a running session's chat: the recorder bar takes the line's place and is the box itself (one edge, no second box, no extra row). | JordiParraCrespo/oppenheimer#896 |
| 2026-11-17 | Where does text written for a model live: strings in the policy files, or files of its own? | Files of its own. The strings in the policies are what the user finds most annoying in the bots' code; the prose is Markdown in `domain/prompts/`, and the policy keeps the logic. | this file's pull request |
| 2026-11-17 | The bot-stack refactor: one pull request at a time, each merged before the next? | No. Work in stacked pull requests, each based on the one before; none merges until the user says so. | this file's pull request |
| 2026-11-18 | More prompt files than two folders hold well: nest a second level, or add sibling folders? | Sibling folders, one level: `system/`, `turn/`, `wake/` (a turn an event opened), `jobs/` when the dream and reviews move. | this file's pull request |
| 2026-11-18 | Build a channel feature that spans who may talk and who answers (grants, Settings, waking on groups) as one pull request? | No: access first (grants, the bot's tool, Settings; stored and shown, waking nothing), then a second pull request that wakes on them. | this file's pull request |
| 2026-11-20 | Build an automatic path across for runner hosts stuck on an old version? | No. The runner runs on one Mac, which the user moves by hand; fix what failed (here, the leftovers in staging) and say how to move a host by hand. | JordiParraCrespo/oppenheimer#940 |
| 2026-11-20 | The bots sidebar should look "like the sessions": which parts? | All of it, as the sessions do it: the shimmer while working and no green dot on the face; the amber dot for every way a bot waits on you (approvals, questions, a failed turn); the blue dot for a reply not yet read, kept on the API so it holds on every device; and Mark as unread in the row's menu, kept on the device. Replaces the device-only "seen" version. | JordiParraCrespo/oppenheimer#943 |
