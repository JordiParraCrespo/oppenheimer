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
| 2026-11-15 | In a sandbox whose network blocks Docker Hub and the Go toolchain, push when every other `ci:local` step is green? | Yes: push and open the pull request, the red rows explained as the sandbox's, showcase screenshots standing in for the console's. | this file's pull request |
| 2026-11-16 | Mimic another app's UI: copy its (permissively licensed) code with its notice, or rebuild the look? | Rebuild the look in our own code, from screenshots; copy none of its code, and name the source app nowhere (code, notices, commits, pull requests). | this file's pull request |
| 2026-11-17 | How should a composer (New session, bots, a session's chat) look while dictating? | Like a running session's chat: the recorder bar takes the line's place and is the box itself (one edge, no second box, no extra row). | JordiParraCrespo/oppenheimer#896 |
| 2026-11-17 | Where does text written for a model live: strings in the policy files, or files of its own? | Files of its own. The strings in the policies are what the user finds most annoying in the bots' code; the prose is Markdown in `domain/prompts/`, and the policy keeps the logic. | this file's pull request |
| 2026-11-17 | The bot-stack refactor: one pull request at a time, each merged before the next? | No. Work in stacked pull requests, each based on the one before; none merges until the user says so. | this file's pull request |
| 2026-11-23 | How are the bots' prompt files organized: by where the words are sent, or by area? | By capability: one folder per area (`core/`, `mail/`, `sessions/`…), the kind (`system`, `turn`, `wake`, `job`, `tools`) as the file's first word. Replaces the 2026-11-18 answer (sibling folders by kind). | this file's pull request |
| 2026-11-18 | Build a channel feature that spans who may talk and who answers (grants, Settings, waking on groups) as one pull request? | No: access first (grants, the bot's tool, Settings; stored and shown, waking nothing), then a second pull request that wakes on them. | this file's pull request |
| 2026-11-20 | Build an automatic path across for runner hosts stuck on an old version? | No. The runner runs on one Mac, which the user moves by hand; fix what failed (here, the leftovers in staging) and say how to move a host by hand. | JordiParraCrespo/oppenheimer#940 |
| 2026-11-20 | The bots sidebar should look "like the sessions": which parts? | All of it, as the sessions do it: the shimmer while working and no green dot on the face; the amber dot for every way a bot waits on you (approvals, questions, a failed turn); the blue dot for a reply not yet read, kept on the API so it holds on every device; and Mark as unread in the row's menu, kept on the device. Replaces the device-only "seen" version. | JordiParraCrespo/oppenheimer#943 |
| 2026-11-23 | Cite pull requests in rules and skills ("#959: …", "in the last two hundred pull requests…")? | No. A rule or skill states the content itself, with the example inline; it never points an agent at pull requests or review history to look up. | JordiParraCrespo/oppenheimer#997 |
| 2026-11-23 | When a runner session's agent needs the user (a question or a permission), where must they be told? | Everywhere it can reach them now: the Inbox as soon as the agent asks (not 30 s later), a browser notification from the console, and the Chrome extension for runner sessions too. A phone push follows later, built on the backend. Codex must be on par with Claude: its prompts checked against the real CLI. | this file's pull request |
| 2026-11-24 | ci:local red only on a load-sensitive timing test because the host is busy? | Hand the branch to a cloud session (`claude --cloud`) to run ci:local and open the pull request there. | this file's pull request |
| 2026-11-24 | Controls render at 28, 30, 32 and 34px: how strict is unifying their heights? | Strict: every control (button, field, select, tab, pill, composer button) stands on the 28 / 34 / 42 ramp, through the `--control-h-*` tokens; a 30 or 32 snaps to 28 or 34 by its row, and a check refuses a hard-coded height off it. Done as a campaign with a ledger, one pull request per pass. | this file's pull request |
| 2026-11-24 | How is the Chrome extension published and kept up to date? | On the Chrome Web Store as an unlisted item, so Chrome updates installs itself; CI uploads and submits each new `apps/extension` version through the Web Store API. | this file's pull request |
