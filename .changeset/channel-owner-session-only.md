---
"@oppenheimer/api": patch
---

Naming a channel's owner is for a browser session only: `POST
/v1/telegram/accounts/:id/owner-link`, `POST /v1/whatsapp/accounts/:id/owner`
and `…/owner/confirm` refuse every API token and OAuth grant (`TOKEN_006`),
whatever its scopes, since the owner's line starts turns with the bot's full
tools and memory.
