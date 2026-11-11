---
"@oppenheimer/runner": minor
---

WhatsApp replies can quote the message they answer: a `whatsapp.send` with
`replyTo` goes out as an extended text naming the quoted message and its
sender, inside the same host budget as any send. A sender or direct chat
that arrives as a `@lid` id is reported by its phone number, from WhatsApp's
alternative address or the device's LID map, so the owner a bot answers on
WhatsApp is recognised however WhatsApp addresses them; an id whose number
is not known yet keeps its `@lid`.
