---
'@oppenheimer/design-system-web': minor
'@oppenheimer/frontend-web': minor
'@oppenheimer/web': patch
---

Enter sends while you dictate. In New session, a session's chat and a bot's
chat, Enter (in the field, on the recorder, or with nothing focused once the
recorder has replaced the field) ends the recording and sends as soon as what
was said lands in the draft, so the spoken rest is never dropped; a failed
transcription sends nothing and leaves the draft; Enter on the recorder's
own buttons stays theirs, so Cancel cancels. `DictationSlot` takes `finish`,
a promise that settles once the text has landed (`useDictation().finish`),
and the composers' shared send takes a generic `beforeSend` that holds a
send until it settles.
