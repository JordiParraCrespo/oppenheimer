---
"@oppenheimer/shared": patch
---

Add the `hosts` deployment capability: a deployment with no runner release and
no signing key cannot pair a machine, and says so rather than failing to boot.
