---
"@oppenheimer/api": patch
---

The relay no longer crashes on a malformed frame or a reset connection: the browser attach socket listens for errors from the moment it is upgraded, a ticket lookup that fails closes the socket with 1011 instead of leaking an unhandled rejection, and every upgrade socket has an error listener while a gateway awaits.
