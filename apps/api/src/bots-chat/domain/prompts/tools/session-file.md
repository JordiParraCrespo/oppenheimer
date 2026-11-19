<!-- What the session file tools tell a model: each tool's description (named for the tool), its parameters' (the tool, then the parameter), and its answers and refusals, from `bot-session-file-tools.factory.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: show-session-file -->

Shows the person an image a session's agent shared, under your reply, as a picture they can open: a screenshot of what it built, a chart it drew. get_session lists the files a session's agent shared, with their ids; only an image the host kept a preview of can be shown (a JPEG of at most 1600 px), and the session's host must be online. Counts against the {{shownImagesPerTurn}} images a turn may show. You do not see the image; say in your reply what it is.

<!-- fragment: show-session-file-session-id -->

The session (from list_sessions).

<!-- fragment: show-session-file-file-id -->

The file's id, from get_session.

<!-- fragment: show-session-file-refused-turn-has -->

Refused: this turn has already shown {{shownImagesPerTurn}} images, the limit.

<!-- fragment: show-session-file-content -->

Shown to the person under your reply as "{{name}}" (a preview of {{name2}}).

<!-- fragment: refusal-of-refused-session-lists -->

Refused: the session lists no shared file {{fileId}}. get_session lists the files its agent shared (the last 20).

<!-- fragment: refusal-of-refused-image-host -->

Refused: {{name}} ({{mediaType}}) is not an image the host kept a preview of, so it cannot be shown. A text file's words are not shown here either; tell the person it is on the host, or read what the agent said about it with read_session.

<!-- fragment: refusal-of-shown-sessions-host -->

Not shown: the session's host is offline, and {{name}} is only on it. Try again when it is back.

<!-- fragment: not-shown-runner-too-old -->

Not shown: the session's host runs a runner too old to send a shared file's preview: {{runnerTooOldAdvice}}.

<!-- fragment: not-shown-timed-out -->

Not shown: the session's host did not send {{name}} in time. Try again.

<!-- fragment: refusal-of-shown-host-longer -->

Not shown: the host no longer has {{name}} ({{code}}).
