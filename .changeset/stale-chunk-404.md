---
'@oppenheimer/web': patch
'@oppenheimer/frontend-web': patch
---

A chunk a deploy removed no longer breaks the console until the cache expires: nginx answers a missing `/assets/` file with an uncached 404 instead of a cacheable `index.html`, and the stale-build reload no longer swallows the import error, which had made the router crash on "reading 'component'" before the page reloaded (#710, Sentry OPPENHEIMER-WEB-4).
