---
'@oppenheimer/web': patch
---

Typed letters no longer drop a few pixels into place when the host's echo lands. xterm measured the terminal's cells once, on the fallback face, and a face that loaded after kept that box on the WebGL renderer while the typeahead drew on the real one; the terminal now has xterm measure again whenever one of its faces arrives.
