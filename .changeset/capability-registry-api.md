---
"@oppenheimer/api": minor
---

A missing optional key now disables a feature instead of booting with a
`'not-set'` sentinel. The OAuth config keys are genuinely optional
(`z.string().optional()`) rather than defaulting to `'not-set'`, and blank or
whitespace-only env vars normalize to `undefined` across the optional
OAuth/Stripe/S3/email keys.

The client-facing subset of the resolved set (`CLIENT_CAPABILITIES`: the OAuth
providers and `stripe_billing`) is served at `GET /health/capabilities`, exempt
from scope checks like other anonymous reads. Server-internal capabilities stay
in the startup log.
