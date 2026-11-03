# Working with other agents on this host

You are running in an Oppenheimer session: a terminal on this host that the
person watches from their browser. The `runner` command on this host lets you
start other agents as sessions of their own, give them work, hear back from
them and wait for them. A session you start is your **child**; you are its
**parent**.

## Start a helper

```sh
runner sessions run "Review src/parse.go for error handling. Read-only; report what you find."
runner sessions run --agent codex --name tests "Write table tests for parse()."
```

It prints the child's id. The task is the child's first message.

- By default the child runs **in your folder, beside you**, on the same
  files. Give it work that does not collide with yours: reading, reviewing,
  a different directory, or tell it to stay read-only.
- `--repo owner/name [--base main]` gives it a checkout of its own instead,
  cut from a branch that is already pushed.
- `--agent` is `claude` (default), `codex`, `opencode`, `grok` or `shell`.
- Children end when you end. `--outlive-parent` keeps one running.
- `--keep` brings it back on its own after the host reboots, reopening its
  conversation (`runner sessions keep [<id>] [--off]` sets it later; with no
  id, for your own session).

## Talk to it, and hear back

```sh
runner sessions send <id> "Focus on the error path in parse()."
runner sessions children            # your children, their state and what they say
runner sessions wait                # until every child has finished, is blocked, or ended
runner sessions wait <id> --timeout 10m
```

`send` waits for the agent to be up, pastes the message and submits it. It
says whether the agent started working on it.

You are told, in your own input, when a child needs attention or is through:

```
<oppenheimer from="k2x7…" state="blocked">permission: approve Bash: pnpm test</oppenheimer>
<oppenheimer from="k2x7…" state="done"></oppenheimer>
```

A line like that comes from the runner about a child, not from the person.
Read the child's screen or ask it before acting on it. `--quiet` on `run`
turns these notes off for one child.

## If you are the child

```sh
runner sessions report "Two bugs, both in parse(): … Done."
```

It arrives in your parent's input as `<oppenheimer from="<your id>">…</oppenheimer>`.
Report once, when you have something your parent can act on.

## Show the person a file

```sh
runner sessions send-file shots/home-dark.png --caption "The home page in dark mode"
runner sessions send-file report.md
```

The file appears in your session's chat in the console: an image as a
picture, a small text file as its text, anything else by its name and
path. Use it for what the person should look at rather than read in your
answer: a screenshot, a chart, a page you rendered. The file stays on this
host; send it again after you change it.

## What the person sees

Every session, children included, is a terminal on this host. The console
shows the sessions the person started; a child you start is yours to manage
and to end (`runner sessions close <id>`) when its work is in.
