---
"@oppenheimer/runner": patch
---

WhatsApp pairing no longer fails with `err-client-outdated`: the runner is on a current whatsmeow (Go 1.26), sends WhatsApp Web's current version in the handshake, fetched before every pairing and connection, and when WhatsApp refuses a linked device as outdated later, fetches the version again and reconnects.
