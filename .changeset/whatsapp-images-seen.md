---
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
---

Bots see WhatsApp images. The runner keeps each image's media key and path
(never the image) for 48 hours, as it does a voice note's, and hands the
image over when asked (`whatsapp.media.get` with `kind: "image"`, answered
by `whatsapp.media` or `WA_005`–`WA_007`), behind the new `whatsapp.image`
capability; one past a link frame is scaled down to a JPEG that fits. An
image the owner sends, or a contact sends in a chat the number allows,
queues the chat bot's turn as before, with its caption; when the turn
starts, the API fetches the image and stores it as an image of the message,
so the model is sent it and the chat shows it. One that cannot be fetched
reaches the bot as `[image, could not be seen: …]`, so it can say why.
