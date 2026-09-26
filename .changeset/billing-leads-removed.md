---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": minor
"@oppenheimer/backend-core": patch
---

Remove the Stripe `billing` module and the `leads` example the project
inherited from the Flama starter. Neither was ever composed into the API, so no
endpoint a deployment served goes away; what goes is everything that existed
only for them. Stripe billing can be brought back from the Flama starter's
`billing` plugin, then `pnpm generate:api-client`.

These are breaking changes for anything that imported the removed names, which
is why the packages below take a minor bump while they are on 0.x.

- `@oppenheimer/api` drops `src/billing`, `src/leads`, the `stripe` config and
  the `stripe` dependency, and the `stripe_billing` capability (and with it the
  property on `GET /health/capabilities`). A new migration,
  `1789600000000-DropBillingAndLeads`, drops the `lead`, `subscription` and
  `billing_customer` tables, which nothing ever wrote; the migrations that
  created them stay, since deployed databases have run them. The `STRIPE_*`
  variables leave `.env.example`.
- `@oppenheimer/shared` drops the `billing` and `leads` scope resources and
  permission groups (so the `billing:*` and `leads:*` scopes), the
  `stripe_billing` deployment and client capability, the `Billing` subject, the
  `GET /billing/subscriptions` endpoint policy and the billing and lead schemas.
- `@oppenheimer/api-client` drops the legacy `BillingApi` and `LeadsApi`
  services and their models, and the regenerated types no longer carry the
  removed scopes or `stripe_billing`.
- `@oppenheimer/translations` drops the `BILLING_*` and `LEAD_*` error copy and
  the unused billing entry of the team page's permission areas.
- `@oppenheimer/backend-core`: the capabilities registry's docs no longer use
  Stripe as their example.
