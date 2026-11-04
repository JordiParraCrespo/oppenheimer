---
"@oppenheimer/api": patch
---

A Gmail routine is no longer handed old mail as new. The poll drops the history mark of every account it does not read, so an account watched again after a pause, a deleted routine or a revoked grant starts from now; a message Gmail received more than two days before the poll never wakes a routine; spam, trash and chats never do; and a routine watching for any mail wakes only on what arrives in the inbox. The runs a rate limit refuses in one hour are one line in the bot's chat instead of one per run.
