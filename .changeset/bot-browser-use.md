---
'@oppenheimer/shared': minor
'@oppenheimer/runner': minor
'@oppenheimer/api': minor
---

A bot can drive a browser of its own on a host. `use_browser` does one thing
(open an address, read the page, click or type by an element's ref, press
keys, scroll, go back, wait, close) and returns the page: its title and
address and everything on it that can be acted on, each with a ref. A model
that reads images also gets a picture of the page; one that does not browses
by text.

The host decides: nothing happens until the person there runs `runner
browser on` (`runner browser` shows the setting and the browser a bot would
get). The runner starts the host's Chrome, Chromium or Edge headless, one per
bot with a profile of its own, and drives it over the DevTools protocol.

On the link this is `browser.act` / `browser.page`, gated on the new
`browser.use` capability. Refusals are `BROWSER_001` (off on the host),
`BROWSER_002` (no browser installed), `BROWSER_003` (the action does not fit
the page), `BROWSER_004` (the browser or the page failed) and `BROWSER_005`
(the setting cannot be read).
