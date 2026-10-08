# Session share links

A member of a session's workspace can open that session's terminal to
someone outside it with a link: to watch, or to type. Asked for on
2026-10-08 ("share a session with a public link", then "people should be
able to write as well and only read too", then "some kind of protection
like anyone or some user"). This note records what was built and why.

## Decided

- **A link is two choices.** *Access*: `read` watches the terminal, `write`
  types into it. *Audience*: `anyone` with the link, signed in or not;
  `accounts`, anyone signed in to Oppenheimer; `people`, only the accounts
  whose emails the link names. The console defaults to the narrowest useful
  link: watch, signed-in accounts, one day.
- **A link has no authority of its own: it acts as the person who made it.**
  Every attach through a link is judged as its creator's terminal would be —
  still a member of the workspace, account still active, still holding
  `update Session` on their current roles, host still theirs to use,
  session not stopped or closed — at redemption and every minute
  after (`REAUTHORIZE_INTERVAL_MS`). So losing access ends every link one
  made without anybody revoking them, and a link can never open more than
  its creator could. `write` is a shell on the host *as the creator*; the
  dialog says so, louder when the audience is wider than named people.
- **A link that lets anyone type expires within seven days** (decided
  2026-10-08). It is a shell for whoever finds it, so it is never "until
  revoked" and never a month. The API's schema refuses anything longer, the
  aggregate refuses to issue one, and a `CHECK` holds it in the table; the
  dialog offers nothing past the cap for that pair. Every other link may
  live until revoked.
- **Read-only is enforced twice, neither by the browser.** The relay drops
  every keystroke frame from a read-only attachment, and the runner attaches
  tmux with `-f read-only,ignore-size` (tmux 3.2+) and drops the frames too.
  `ignore-size` keeps a watcher out of `window-size latest`, so someone
  watching on a phone cannot shrink the pane under the person typing. The
  console also disables xterm's input, which is only so the pane does not
  look typeable. `session.attach` carries an optional `readOnly`; a runner
  that predates it attaches normally and the relay still keeps it read-only.
- **The secret is a 256-bit random token, stored only as its SHA-256**, like
  an API token. It is shown once, at creation; a lost link is revoked and
  made again. In the console the address is `/shared#<token>`: the secret is
  the URL **fragment**, which a browser sends to no server, so it reaches no
  access log, proxy or `Referer`. The console then sends it in a request
  body (`POST /v1/shared-sessions/lookup`, `POST
  /v1/shared-sessions/attach-ticket`), never a path or a query string. The
  ticket itself is the ordinary attach ticket: single use, sixty seconds, a
  WebSocket subprotocol.
- **A list of people is matched on a verified email.** Sign-up does not
  require verification here, and an unverified address is a claim anybody
  could make. The comparison is case-insensitive.
- **Refusals are distinct where the holder can act on them.** Unknown,
  revoked and expired links, and links to a closed session, are one answer
  (`SESSIONS_021`), since the holder can only ask for a new one. "Sign in"
  (`SESSIONS_022`) and "not shared with you" (`SESSIONS_023`) are their own,
  because each has a different next step. A signed-out holder of an
  `accounts` or `people` link is sent to sign in; the secret waits in
  `sessionStorage` for the trip rather than in the `?redirect=`.
- **Revoking is immediate for new terminals and within a minute for open
  ones**, by the relay's existing re-check. Any member who may update the
  session may revoke any of its links. A session holds at most twenty live
  links (`SESSIONS_024`). Closing or erasing the session, or erasing the
  account that made a link, deletes its links (foreign keys, `ON DELETE
  CASCADE`).
- **The public page shows only the session's name, its state, the access the
  link gives and who shared it.** Nothing about the workspace, project, host
  or repository. It opens window 0, the agent's, and the holder's request
  names no window, so a link never reaches a shell window opened beside it.
  A stopped session says so; only a member can restart it.
- **Sharing is `update Session` behind `sessions:write`**, the same rule as
  opening a terminal: sharing one is opening it for somebody else. Listing a
  session's links is `read Session`.

## Compared with OpenClaw

Checked on 2026-10-08 against its docs (docs.openclaw.ai: `plugins/session-share`,
`concepts/session-attachment`, `cli/attach`, `gateway/security`). OpenClaw has
no bearer link: a URL only selects a session, and access always needs a paired,
approved device. Its Session Share plugin is read-only by allowlist, shares
user and assistant text only (no tool output), is polled rather than live, and
re-checks sharing on every read; its docs say plainly that revoking does not
take back what a viewer already read. `openclaw attach` grants are short and
end with the process. Two things taken from it: the dialog says that a viewer
sees everything the terminal shows and that revoking does not un-see it, and
the creator-access rule matches its "an approver never grants more than they
hold". Its server-side cap on every grant became the seven-day cap on a link that
lets anyone type; a transcript-only level under `read` is left open below.

## Open questions

1. **Re-copying a link.** Only the digest is kept, so the address cannot be
   shown again. Keeping it encrypted would allow it at the cost of a secret
   at rest; not done.
2. **Who is watching.** The owner cannot yet see who has a link open. The
   relay knows the attachments per session; a list of them is the obvious
   next step, with a way to drop one.
3. **Windows other than the agent's.** A link opens window 0 only, as the
   console's own pane does today.
4. **A transcript-only level.** Below `read`: the conversation as text,
   without the terminal, as OpenClaw's Session Share does.
5. **Notifying the people named.** A `people` link is shared by hand; an
   email to each address is the teams slice's mail.
