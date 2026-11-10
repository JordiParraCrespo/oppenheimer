---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

A bot babysits the work it hands off. The stall check five minutes after
`start_session` or `send_to_session` is now the first of up to six checks:
while the task runs, the bot is woken every ten minutes to read what the
agent has done against its task, ends quietly (`nothing_to_report`) when it
is on track, and tells the person when the agent went idle, loops, drifts,
waits or fails. The chat shows "Checked on session “X”" (a new `progress`
session event state). Asked to monitor a session, a bot now looks at once.
