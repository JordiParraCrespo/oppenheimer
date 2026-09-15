import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * Stripe billing configuration. Every value is optional capability config so
 * the app boots without Stripe configured (per `.agents/rules/api-config.md`)
 * — a missing `secretKey` disables the `stripe_billing` capability and the
 * billing endpoints fail fast with a clear "billing not configured" error
 * instead of crashing the process at startup.
 */
const schema = z.object({
  secretKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  /** Fallback redirect URLs for Checkout / Customer Portal (per-request overridable). */
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  portalReturnUrl: z.string().url().optional(),
});

export const stripeConfig = registerAs('stripe', () =>
  parseEnv('stripe', schema, {
    secretKey: 'STRIPE_SECRET_KEY',
    webhookSecret: 'STRIPE_WEBHOOK_SECRET',
    successUrl: 'STRIPE_SUCCESS_URL',
    cancelUrl: 'STRIPE_CANCEL_URL',
    portalReturnUrl: 'STRIPE_PORTAL_RETURN_URL',
  }),
);
