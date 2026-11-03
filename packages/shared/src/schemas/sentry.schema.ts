import { z } from 'zod';

/**
 * Connecting a workspace's Sentry organization (`product/next-steps/sentry.md`).
 *
 * The owner makes an internal integration in Sentry (Settings → Developer
 * Settings → Custom Integrations), turns on its `issue` and alert webhooks,
 * and pastes its client secret here: Sentry signs every webhook with it. The
 * webhook URL the API answers with goes back into the integration.
 */
export const putSentryConnectionSchema = z.object({
  /** The organization's slug, as in `https://<slug>.sentry.io`. */
  organizationSlug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(
      /^[a-z0-9][a-z0-9_-]*$/,
      'A Sentry organization slug is lowercase letters, digits, - and _',
    ),
  /** The integration's client secret: the key of the webhook signature. */
  clientSecret: z.string().trim().min(16).max(256),
});

export type PutSentryConnectionDto = z.infer<typeof putSentryConnectionSchema>;
