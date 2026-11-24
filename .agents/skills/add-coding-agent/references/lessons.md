# What each integration taught

The why behind the rules in `SKILL.md`, filed under the step they belong to,
each with the commit that learnt it. Read a step's section when that step
raises a question; `git show <commit>` holds the code. A new integration that
learns something adds it here, under its step, and adds at most a pointer
to `SKILL.md`.

## The agents so far

| Agent | Commits | Shape worth copying |
| --- | --- | --- |
| Grok | `83f361787` | the smallest whole integration |
| Pi, Oh My Pi | `3b5d38192`, `c1c5084f5` | two agents from one family in one module |
| Antigravity | `fd6277d28`, `79ace7978`, `a4dc02789` | a binary named unlike its id |
| fx | `d577bfe64`, `5ffc607ee`, `3e653460e` | a gateway model id; a status-line working rule |
| ZCode | #985, #994 | no first task; a chat from a SQLite database; a prompt clear |
| Hermes | `af020b8eb`, `37ef2996d`, `3887274fe`, `d19b81759`, `788f60f93` | a client of its own gateway; a chat from its own database |
| Muse | `d2644b596`, `6dd44e03f`, `ba75005b3` | a self-updating launcher; no first task |
| Qwen Code | `494d61e0c`, `08e704a62`, `0b173cc15` | a task inside its flag's word; a chat that follows the conversation the CLI moves to; a clear from both ends |
| OpenCode (chat) | `9b0c57f9f`, `2cc185b6e`, `075bf1e58`, `15c13b76a` | a chat through the agent's local API |
| Codex, Grok (chat) | `dc675593a`, `c18fdf18d`, `e65405548` | a chat from a transcript file |

## 1. Reading the CLI

- **Docs lie; the parser does not.** Guides and blog posts were wrong or stale
  more than once; every entry's values come from the argument parser and the
  TUI source at a named version.
- **No `--model` means no models.** A strict parser exits on an unknown flag,
  so a model the CLI cannot take must never reach argv (ZCode).
- **Send Ask even when the CLI defaults to permissive.** omp runs yolo by
  default; the console's Ask still means ask (`3b5d38192`). Pi has no
  approvals by design, so its entry has no `permission`.
- **A positional can be a subcommand.** ZCode reads one as a subcommand, so a
  task sent there would make it exit; its TUI takes no first task (#985).
  Never the headless `-p` either: it answers and exits.
- **A resume flag can fail where there is nothing to resume.** ZCode's
  `--continue` exits with "No resumable session found" before its TUI starts,
  so a session restarted before its first message came back with no agent.
  The flag was left out (#985).
- **"The newest in this folder" is not this session's.** Two OpenCode sessions
  sharing a folder resumed each other's conversation; reopening by id fixed it
  (`075bf1e58`, `conversation.reopen`).

- **A task that starts with `-` is a flag.** Qwen Code 0.28.4 read
  `--prompt-interactive "-v"` as `-v`, printed its version and exited; the
  `--prompt-interactive=<task>` form does not (found by the skill's eval,
  `evals/`).
- **A by-id resume can exit before the first message too.** Qwen's
  `--resume <id>` says "No saved session found" until it has written a
  transcript; `--continue` opens a fresh session instead. The runner already
  reopens a learned id through `conversation.reopen`; a plan that invented a
  new field missed it (eval).
- **Read the screen live even without a key.** A fake OpenAI-compatible server
  on loopback, scripting one tool call, showed every Qwen state in tmux;
  strings read only from a bundle left a guessed idle rule (eval).
- **An updater can be a no-op.** `qwen update` on an npm install prints
  instructions and exits 0; shipped as `update`, it would report success and
  change nothing (eval).
- **A login target is what the person sees.** Qwen's OAuth API base is
  `auth.qwen.ai`; the URL shown is on `chat.qwen.ai` (eval).
- **A resume of "the newest here" can start a new conversation under a name
  of the CLI's choosing.** Qwen's `--continue` with nothing saved opened a
  fresh TUI under a random id, and every later `--continue` kept to it, so
  the session's own id named nothing; the chat follows it (§5,
  `494d61e0c`).
- **Reopen by id once the CLI has written it, create it again before.**
  Qwen's restart was `--continue` alone, which in a folder another Qwen
  shares can open the other's conversation. The runner now asks the
  transcripts whether the session's conversation was saved
  (`SavedConversation`, setting `Launch.Saved`) and reopens it with
  `conversation.reopen` (`--resume <id>`) only then, since before it the
  by-id form exits. Before it, "the newest here" is still not safe (review):
  the restart creates the conversation again under the session's id
  (`--session-id <id>`), which Qwen refuses only once the file exists
  (watched). Never with the task: with chat recording off nothing is ever
  written, and the task would run again at every restart. And "no file" is
  not "nothing said": the runner says NotSaved only beside Qwen's own launch
  marker (`<id>.runtime.json`), since chats kept under another directory or
  archived would make the id taken (review).
- **A stored user message is not what the person typed.** Qwen stores an
  `@file`'s contents, a hook's context and system reminders as parts after
  the typed text; the chat shows `systemPayload.displayText` when kept, and
  otherwise drops the blocks Qwen's own export drops (review, §5).

## 2. The catalog entry

- **One label per model id, across agents.** Antigravity labelled a model
  another agent already listed differently, and the console showed two names
  for one model (`a4dc02789`).
- **A gateway id may need its provider.** fx's ids reach the gateway only with
  `--provider gateway` pinned in `launch.model` (`5ffc607ee`).
- **Shared effort levels live once.** Antigravity's Gemini levels went into
  `effort-levels.ts` as `GEMINI_4_LEVELS` for every agent that offers them.
- **No first task reaches every picker.** Muse took none, and New session
  still required one, a bot waited on a task Muse never got, and Plan's Start
  session moved the task to In progress beside an idle terminal
  (`6dd44e03f`, `ba75005b3`). Each now derives from the catalog (`takesTask`,
  the bot launch policy, the automation filters); their comments name the
  agents left out.
- **An agent whose work outlives its terminal needs `quit`.** `hermes chat` is
  a client of Hermes' gateway, which runs the turn: killing tmux only
  detached, and a stopped session kept working. `/stop`, `/quit` typed first
  ends it (`d19b81759`).
- **Install code stays out of the catalog.** The console loads the catalog on
  its first page, and the install scripts weighed on it (`22ee3f839`); they
  live in `host-setup.ts`.
- **A half-failed install must not look installed.** Muse's launcher stayed on
  `PATH` without its binary, probed as installed, and nothing retried; the
  script now removes it on failure (`6dd44e03f`).
- **A placeholder can sit inside a word.** Qwen's task rides as
  `--prompt-interactive=<prompt>` so a leading `-` stays a value; the runner
  replaced `<prompt>` only as a whole word until `494d61e0c`
  (`substituteWithin`, and the catalog spec's "ends on the task").
- **A new catalog field is three edits.** `clear` (#994) and `quit`
  (`d19b81759`) each took the field in `catalog.ts`, a line in the emitter
  and the Go that reads it; when both landed at once they met in `input.go`
  and the emitter.

## 3. Typing into it

- **A TUI can put text in its own prompt.** ZCode recalls its last prompt on an
  Up arrow into an empty prompt, and an approval dialog's Up or a wheel over
  the terminal sends one; the next message was sent joined to it
  ("…DONEONE.Now create…", #994).
- **Ctrl+U, not Ctrl+C.** ZCode empties its draft on Ctrl+U; Ctrl+C counts
  towards quitting.
- **The clear and the words must not share a burst.** ZCode applies the clear
  on its next render, so words in the same write landed in the prompt it had
  not emptied yet. 100 ms between them fixed it, which is `settleMs` (#994).
- **Look for every way text gets there, and clear from both ends.** Qwen
  recalls history on Up with the cursor at the start (so Ctrl+U alone did
  nothing), puts a turn stopped with Esc back with the cursor at the end, and
  puts a rewound turn back for editing; Ctrl+E, Meta+D and Ctrl+U, repeated,
  empty all three.
- **The clear must be inert in every dialog the prompt can sit under.** Qwen's
  first clear, Ctrl+K and Ctrl+U, emptied the prompt, but its Rewind
  dialog's restore options move up on `k` whatever the modifiers, so each
  Ctrl+K walked the selection to "Restore code and conversation". Read the
  key handlers of the TUI's dialogs, and send the clear into each one live.
- **Measure the settle; do not copy it.** Qwen applies each key to its buffer
  as it reads it, and a message in the same write as the clear was stored
  whole, so its `settleMs` is a margin; ZCode's 100 ms was a need
  (`494d61e0c`).
- **A second Stop is not always harmless.** Qwen's Esc twice at an empty
  prompt opens "Rewind Conversation", where an Enter picks a turn to go back
  to; its manifest reads that dialog as blocked (`08e704a62`).
- **Every sender, from one fact.** The console, the API and the runner each
  type into agents; the first fix hard-coded ZCode's keys in each, and review
  moved them into the catalog (`clearOf`, #994).

## 4. The runner

- **A missed installer alias stops a pairing.** `install.sh` knew
  `antigravity`, the binary is `agy`, and a host paired with it failed
  (`79ace7978`).
- **Anchor a working rule to the status line.** fx's "Working" rule matched a
  reply saying "Working tree is clean"; anchored, it did not (`5ffc607ee`).
- **List every word the status line takes.** fx also says "Thinking", which
  read as unknown mid-turn (`3e653460e`).
- **Give the idle prompt a rule.** A sample that reads as `unknown` resets the
  30 seconds the API waits before a blocked session counts as waiting on
  you, so a dialog flickered in and out of "needs you" (ZCode, still open).
- **Match what tmux shows, not bytes.** The raw PTY stream splits words with
  cursor moves; `tmux capture-pane -p` is what a rule sees.
- **The help line is a contract.** `sessions run --agent` lists agents that
  take a task; Muse was added to it anyway (`d2644b596`), and `DropsTask`
  refuses it at run time. Fixed in #1003: the help lists now come from the
  runner's own table (`AgentNames`, `Installable`), so a new agent edits no
  help line.
- **A TUI may not draw at the pane's foot.** Qwen's Ink UI sits under its
  scrollback with blank rows below; `bottom:N` counts non-empty lines, so it
  still works, but check it on the capture (`494d61e0c`).
- **A placeholder that stays mid-turn is no idle signal.** Qwen's `Type your
  message` stays up while it works and goes when the prompt holds text; its
  idle rule is the footer naming the approval mode, guarded by the
  mid-turn footer (`494d61e0c`).

## 5. The chat view

- **Filter before you window.** ZCode writes six hidden rows a turn; a "last
  20" read that dropped them afterwards took a short window for the whole
  conversation and lost a burst of turns (`b92eac989`).
- **The agent's schema is not yours.** Hermes from before
  `transcript_revision`, `message_uid` or `display_metadata` failed to load
  until rows were read by column name (`788f60f93`).
- **Compaction writes a conversation twice.** Hermes archives rows and writes
  the turns it keeps again as live rows; the chat folds each message's copies
  as Hermes does, and leaves `model_only` rows out (`788f60f93`).
- **No SQL from text.** A built `IN (…)` list tripped gosec G202; ZCode reads
  parts by time (`825c981f0`), Hermes passes the list as one JSON parameter
  read with `json_each` (`3887274fe`). Check every `Close`.
- **Secrets stay off argv.** OpenCode's server password went on the command
  line every account can read, then into the session's tmux environment
  (`2cc185b6e`).
- **The CLI writes threads that are not the conversation.** Codex's reviews
  and compactions sat beside the session's own transcript and showed in its
  chat (`e65405548`).
- **A CLI moves the conversation to a new file.** Qwen's `/clear`, and a
  `--continue` with nothing saved, write a new `<id>.jsonl`; in a worktree
  session the reader takes the newest written there since the session was
  created and reports it as the session's (`CurrentConversation`), in a
  folder only the named one (`08e704a62`).
- **Filter by record type, not role.** Qwen hands the model its memory
  catalog as a `user`-role message inside a `system` record; read by role,
  it would be drawn as something the person said (`08e704a62`).
- **A rewind can leave the dropped turns in the file.** Qwen appends a
  `rewind` record pointing back to the branch point; folding it needs the
  follower to restart a history mid-read, which it cannot yet, so the chat
  still shows the dropped turns.
- **The next version moves fields.** Codex 0.167 moved what the reader read
  (`c18fdf18d`): test on samples a real session wrote, and say in the reader
  when the shape is undocumented.

## 7. Proving it live

- **Stand-ins prove wiring, not flags.** Every bug in §1, and the joined
  prompt in §3, passed the stand-in and failed against the real CLI.
- **The sandbox's proxy port moves.** It changes when the session's worker
  restarts, and a wrapper with the old port fails every request.
- **Read `.xterm-rows`, not the socket.** The raw stream splits words, so a
  wait on socket bytes never matched.
- **Check what the agent stored.** The chat can look right while the agent
  received something else; ZCode's database showed the joined prompt.

## 8. Merging

- **A union of two SVG cases can cut a mark.** Merging Hermes beside
  Antigravity, and Muse beside Hermes, each left `agent-mark.tsx` with a mark
  missing its closing tags (`7bc18337f`, `dfdb86b47`).
