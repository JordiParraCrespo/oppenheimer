import { z } from 'zod';

/**
 * Subscription lifecycle states, mirroring Stripe's `Subscription.status`.
 * Stored locally and kept in sync through Stripe webhooks.
 */
export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Statuses that count as a live, revenue-generating subscription. */
export const ACTIVE_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due'] as const;

/** Recurring billing intervals, mirroring Stripe's `Price.recurring.interval`. */
export const BILLING_INTERVALS = ['day', 'week', 'month', 'year'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Body for `POST /v1/billing/checkout` — start a Stripe Checkout session. */
export const createCheckoutSchema = z.object({
  /** The Stripe Price id (e.g. `price_123`) the customer is subscribing to. */
  priceId: z.string().min(1),
  /** Where Stripe redirects after a successful checkout (defaults to config). */
  successUrl: z.string().url().optional(),
  /** Where Stripe redirects if the customer cancels (defaults to config). */
  cancelUrl: z.string().url().optional(),
});
export type CreateCheckoutDto = z.infer<typeof createCheckoutSchema>;

/** Body for `POST /v1/billing/portal` — open the Stripe Customer Portal. */
export const createPortalSchema = z.object({
  /** Where Stripe returns the customer after the portal (defaults to config). */
  returnUrl: z.string().url().optional(),
});
export type CreatePortalDto = z.infer<typeof createPortalSchema>;

/** Response carrying a Stripe-hosted URL to redirect the browser to. */
export const billingSessionResponseSchema = z.object({
  url: z.string().url(),
});
export type BillingSessionResponse = z.infer<typeof billingSessionResponseSchema>;

/** A user's subscription as exposed by the API. */
export const subscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(SUBSCRIPTION_STATUSES),
  priceId: z.string().nullable(),
  /** Human-readable plan name (Stripe price nickname or product name). */
  plan: z.string().nullable(),
  /** Recurring amount in the currency's minor unit (e.g. cents). */
  unitAmount: z.number().int().nullable(),
  currency: z.string().nullable(),
  interval: z.enum(BILLING_INTERVALS).nullable(),
  currentPeriodEnd: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SubscriptionResponse = z.infer<typeof subscriptionResponseSchema>;

/** Monthly Recurring Revenue for a single currency (minor units). */
export const currencyMrrSchema = z.object({
  currency: z.string(),
  mrr: z.number().int(),
});
export type CurrencyMrr = z.infer<typeof currencyMrrSchema>;

/**
 * Aggregate revenue metrics for the admin dashboard, computed locally from the
 * synced subscription table (no live Stripe calls).
 */
export const revenueMetricsResponseSchema = z.object({
  /**
   * Currency of the headline `mrr`/`arr` — the currency with the highest MRR.
   * Use `mrrByCurrency` for the full breakdown on multi-currency accounts.
   */
  currency: z.string(),
  /** Headline Monthly Recurring Revenue in `currency`'s minor units (yearly /12). */
  mrr: z.number().int(),
  /** Headline Annual Recurring Revenue in minor units (`mrr * 12`). */
  arr: z.number().int(),
  /** Per-currency MRR breakdown (never mixes currencies into one total). */
  mrrByCurrency: z.array(currencyMrrSchema),
  activeSubscriptions: z.number().int(),
  trialingSubscriptions: z.number().int(),
  pastDueSubscriptions: z.number().int(),
  canceledSubscriptions: z.number().int(),
  /** Subscriptions canceled within the trailing 30 days. */
  canceledLast30Days: z.number().int(),
  /**
   * Approximate monthly churn: `canceledLast30Days / (active + canceledLast30Days)`,
   * in the range `[0, 1]`.
   */
  churnRate: z.number(),
});
export type RevenueMetricsResponse = z.infer<typeof revenueMetricsResponseSchema>;
