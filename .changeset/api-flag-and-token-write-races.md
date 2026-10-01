---
"@oppenheimer/api": patch
---

Two fixes in the API. The active API token limit is now enforced atomically, so
concurrent requests can no longer create tokens past it. An allowlist entry
written as an IPv4-mapped IPv6 prefix, such as `::ffff:203.0.113.0/120`, now
matches the IPv4 clients it names. Feature flag writes can no longer race one
another or a segment delete, and a failed audit write or flag reload for a flag
change is retried instead of being dropped.
