---
"@oppenheimer/web": patch
---

Leaving Plan's board or calendar for another list no longer takes the console
to its error boundary. Both sidebars are mounted by the shell, which outlives
those routes, so they read their route's search through a match that is
allowed to be gone.
