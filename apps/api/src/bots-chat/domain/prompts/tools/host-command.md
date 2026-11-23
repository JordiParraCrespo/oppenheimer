<!-- What the host command tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-host-command-tools.factory.ts`, `bot-host-command.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: run-command -->

Runs one program on one of the person's hosts and returns its exit code, stdout and stderr, for a quick command or a script: `python3 report.py`, `node build.js`, `git status`, `ls -la`. argv is the program and its arguments, run directly with no shell, so pipes, `&&`, redirects and `$VAR` are plain text unless the program is a shell (`bash -c "…"`), which the host must allow like any other. It starts in your own folder on that host, kept between calls, unless cwd names another; stdin is empty, so write a script there with one call (`python3 -c` code that writes the file) and run it with the next. The host decides what may run: by default nothing, and otherwise only the programs its owner allowed with `runner exec` on the host itself; a refusal says how to allow it, and you pass that on rather than trying another program. Each call lasts at most {{runCommandMaxTimeoutSeconds}} s; longer work, or changing code in a repository, is a session (start_session). Output keeps the last 32 KB of each stream. The host defaults to your home host.

<!-- fragment: run-command-argv -->

The program, then its arguments, each one element: ["python3", "report.py", "--since", "7d"].

<!-- fragment: run-command-host-id -->

The host to run on (from list_hosts); your home host when omitted.

<!-- fragment: run-command-cwd -->

An absolute folder on the host to run in; your own folder there when omitted.

<!-- fragment: run-command-timeout-seconds -->

How long it may run before it is stopped; {{hostExecDefaultTimeoutSeconds}} when omitted.

<!-- fragment: refusals-exec-001 -->

running commands is switched off on this host

<!-- fragment: refusals-exec-002 -->

this program is not on the host’s allowlist

<!-- fragment: refusals-exec-003 -->

the folder to run in is missing or unusable

<!-- fragment: refusals-exec-004 -->

the program could not be started, or the host is already running 8 commands

<!-- fragment: refusals-exec-005 -->

the host’s own exec policy file cannot be read

<!-- fragment: stopped-at-timeout -->

Stopped at its timeout, before it finished.

<!-- fragment: host-offline -->

{{host}} is offline: nothing ran. Try again when it is back, or use another host.

<!-- fragment: describe-host-command-runner-too-old -->

The runner on {{host}} is too old to run commands: nothing ran. The person can update it from the host's page.

<!-- fragment: describe-host-command-did-answer-time -->

{{host}} did not answer in time, so whether it ran is unknown. Check before running it again.

<!-- fragment: host-refused -->

{{host}} refused ({{code}}{{meaning}}): {{detail}}. Nothing ran. Tell the person; only they can change what this host allows, on the host itself.
