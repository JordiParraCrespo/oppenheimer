<!-- What the terminal tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-terminal-tools.factory.ts`, `bot-terminal.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: session-id -->

The terminal session (from open_terminal or list_sessions).

<!-- fragment: wait-fields-wait-for -->

A regular expression (RE2) to wait for on a line of the screen, such as your prompt coming back (`\$ $`) or `password:`. Without it the call waits wait_seconds.

<!-- fragment: wait-fields-wait-seconds -->

How long to wait, at most, before reading the screen; {{defaultTerminalWaitSeconds}} when omitted, at most {{terminalWaitMaxSeconds}}.

<!-- fragment: wait-fields-history -->

How many lines above the visible screen to read too.

<!-- fragment: open-terminal -->

Opens a blank terminal (a plain shell, no coding agent) on one of the person's hosts, in a folder already there, and returns its session id for type_in_terminal and read_terminal. Use it for interactive work a single run_command cannot do: an ssh login, a program that asks questions, a REPL, a job you watch. The person sees it in the console like any session and can take over. The host must allow it (its exec mode is full). The host defaults to your home host.

<!-- fragment: open-terminal-folder -->

An absolute folder on the host to start in: your own folder there (the cwd run_command reports), or one from list_folders.

<!-- fragment: open-terminal-host-id -->

The host (from list_hosts); your home host when omitted.

<!-- fragment: open-terminal-name -->

A short name for the terminal.

<!-- fragment: open-terminal-host-offline-opens -->

The host is offline: it opens when the host comes back.

<!-- fragment: open-terminal-content -->

Opened terminal {{sessionId}} on host {{hostId}} in {{folder}}.{{offline}} Wait for its prompt (wait_for) before you rely on it.

<!-- fragment: type-in-terminal -->

Types into a terminal from open_terminal, as a person would, then waits and returns the screen. text is typed literally (a command line, an answer); keys are pressed after it by name: Enter to run it, C-c to interrupt, C-d to end input, Tab, Escape, arrows. So a command is text plus keys ["Enter"]. Wait for something that shows the command finished (wait_for your prompt, or a program's question) rather than a fixed time. Never type a password or secret: when a program asks for one, tell the person and let them type it in the console.

<!-- fragment: type-in-terminal-keys -->

Keys to press after the text, in order, e.g. ["Enter"].

<!-- fragment: type-in-terminal-nothing-type-give -->

Nothing to type: give text, keys or both. To only look, use read_terminal.

<!-- fragment: read-terminal -->

Reads the screen of a terminal from open_terminal, optionally after waiting for a pattern to show (a job finishing, a prompt coming back). It types nothing.

<!-- fragment: refusals-exec-006-meaning -->

this host does not let bots drive a terminal: its exec mode is not full

<!-- fragment: refusals-exec-006-advice -->

Tell the person; only they can change it, on the host, with `runner exec mode full`.

<!-- fragment: refusals-exec-007-meaning -->

that session is not a blank terminal; use open_terminal for one

<!-- fragment: refusals-sess-001-meaning -->

that session is not on the host

<!-- fragment: refusals-invalid-pattern-meaning -->

wait_for is not a valid regular expression

<!-- fragment: maybe-typed -->

What you gave may already have been typed: read the terminal before typing again.

<!-- fragment: describe-terminal-waited-pattern-if -->

Waited {{waited}}; the pattern, if you gave one, did not show yet.

<!-- fragment: describe-terminal-host-offline-nothing -->

The host is offline: nothing was typed or read.

<!-- fragment: describe-terminal-runner-host-too -->

The runner on that host is too old to drive a terminal. The person can update it from the host's page.

<!-- fragment: describe-terminal-host-did-answer -->

The host did not answer in time; whether the keys were typed is unknown. Read the terminal before typing again.
