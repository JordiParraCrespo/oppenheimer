---
"@oppenheimer/runner": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
"@oppenheimer/shared": patch
---

OpenCode sessions get the chat view. The runner launches OpenCode serving its
own API on a loopback port with a password of the session's, follows the
conversation through it while a browser is attached, and sends each finished
part as a line of the transcript the chat already reads, OpenCode's tools under
the names the chat knows. The chat names the session's agent on its composer and
empty state, and shows no context meter for a model whose window it cannot know.
