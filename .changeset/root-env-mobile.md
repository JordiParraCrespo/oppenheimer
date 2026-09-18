---
"@oppenheimer/mobile": patch
---

Load the root `.env` in `app.config.ts` before Metro bundles, and read the
deep-link `scheme` from `MOBILE_SCHEME` — the same variable the API uses for
its trusted origin — instead of a hardcoded copy.
