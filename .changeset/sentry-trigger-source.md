---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/frontend-web': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

Sentry issues and alerts start automations (`product/next-steps/sentry.md`).

- `@oppenheimer/shared`: `sentry` is the third external trigger source, with
  four events (`issue_created`, `issue_regressed`, `issue_escalating`,
  `alert_triggered`), the `project` and `rule` filter fields, a Sentry
  trigger input and `putSentryConnectionSchema`.
- `@oppenheimer/api`: the `sentry` module. `GET/PUT/DELETE
  /v1/sentry/connection` keep the workspace's Sentry organization and its
  integration's client secret, sealed under the new `SENTRY_CONNECTION_KEY`;
  `POST /v1/sentry/webhooks/:connectionId` checks `Sentry-Hook-Signature`
  with that secret before the inbound-events hub stores anything. A session
  automation takes a Sentry trigger without a repository and runs in its
  first one. `SENTRY_001`–`003`; a migration adds `sentry_connection` and
  `sentry` to the source checks.
- `@oppenheimer/frontend-consumer`: the `sentry` module (`useSentryStatus`,
  `useConnectSentry`, `useDisconnectSentry`), and Sentry triggers read and
  written by the automations repository.
- `@oppenheimer/frontend-web`: `eventLabel` and the trigger words take Sentry's
  events.
- `@oppenheimer/web`: Settings → Sentry (connect, the webhook URL to copy,
  how to make the integration), and the editor's Sentry card and Add trigger
  group.
- `@oppenheimer/translations`: the copy for all of it, in English and Spanish.
