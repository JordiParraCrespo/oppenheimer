---
"@oppenheimer/api": patch
---

A bot's routine runs and wakes no longer reach a provider that just refused
the account (out of quota or credit, or a refused key): for an hour after
such a failure they end without running, so the chat shows one failure card
instead of one per run. A person's message always runs.
