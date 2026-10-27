---
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": patch
"@oppenheimer/web": minor
---

A session read as a chat takes files on its messages. The paperclip, a paste on the chat and a drop on the pane hold them as chips over the field, under New session's rule (an image, a PDF or text, 5 MB, five at a time), and a refused one is said under it. Sending puts each file on the host, whose path the runner pastes into the agent's prompt, then the words and Enter, so the agent takes them as one message; a file that does not arrive keeps it and the words in the composer and says why. `ChatComposer`'s inline layout takes `onAttach` and `attachments`, and `ComposerFile` is the file chip `Composer` and the session chat share. `SessionChat.send` takes `withFiles`, which lets a message be files alone and waits for their paths to land before the words.
