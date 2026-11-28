---
"@oppenheimer/api": minor
---

Bots, `update_bot` (`product/design/bots/bots.md` §4.6): a bot changes the
settings of one or more of the person's bots in one call (provider, model,
effort, permission, group, name, description, colour, learning). It asks under
Approve for me, needs a workspace key for a new provider, refuses a model the
provider does not offer, and never gives a bot looser permissions than the
caller's. `list_bots` and `get_bot` now name each bot's group, so a bot can
pick "the web team" by its group.
