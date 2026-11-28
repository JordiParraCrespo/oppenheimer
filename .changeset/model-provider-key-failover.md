---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Several keys per model provider, and the next one taken when a key runs out of
credit (`product/design/bots/bots.md`, "A provider can hold several keys, and a
spent one hands over").

- `@oppenheimer/api`: `model_provider_credential` holds up to
  `MODEL_PROVIDER_KEYS_MAX` rows per provider, in `position` order, each with a
  `spentAt` mark. `POST /v1/model-providers/:provider/keys` adds one (`BOTS_049`
  past the cap), `PUT …/keys/:keyId` replaces one and
  `DELETE …/keys/:keyId` removes one (`BOTS_050`). A bot turn the provider
  refuses for credit before it wrote anything marks the key and runs again on
  the next; a turn that completes on a marked key clears the mark.
- `@oppenheimer/shared`: `MODEL_PROVIDER_KEYS_MAX`.
- `@oppenheimer/frontend-consumer` and `@oppenheimer/web`: Settings → Model
  providers adds another key, and draws each of several keys on its own row
  with Remove and Replace, a spent one marked out of credit.
