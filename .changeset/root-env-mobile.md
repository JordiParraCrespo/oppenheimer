---
"@oppenheimer/mobile": patch
---

Load the root `.env` before Metro bundles, and read the deep-link `scheme` from `MOBILE_SCHEME` instead of a hardcoded copy.
