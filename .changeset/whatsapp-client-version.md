---
"@oppenheimer/runner": patch
---

WhatsApp pairing no longer fails with `err-client-outdated`: the runner now sends WhatsApp Web's current version in the handshake, fetched before every pairing and connection, and when WhatsApp refuses a linked device as outdated later, the runner fetches the version again and reconnects.
