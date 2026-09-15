import type { BillingInterval, SubscriptionStatus } from '@oppenheimer/shared';

/**
 * A Stripe subscription normalized into the app's own vocabulary, so the
 * application layer never depends on the Stripe SDK's types.
 */
export interface NormalizedSubscription {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string | null;
  plan: string | null;
  unitAmount: number | null;
  currency: string | null;
  interval: BillingInterval | null;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  /** `userId` from the subscription metadata; bootstraps the customer mapping. */
  userId: string | null;
  /**
   * `created` timestamp of the Stripe event this state came from. Stripe does not
   * guarantee delivery order, so the domain uses it to discard stale events.
   */
  eventCreatedAt: Date;
}

/** A verified, normalized Stripe webhook the app knows how to act on. */
export type BillingWebhookEvent =
  | { type: 'subscription.upsert'; data: NormalizedSubscription }
  | { type: 'ignored' };

export interface CreateCheckoutParams {
  customerId: string;
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreatePortalParams {
  customerId: string;
  returnUrl: string;
}

/**
 * Port abstracting the payment provider (Stripe). Implemented by
 * `StripePaymentGateway`; injected through the `PAYMENT_GATEWAY` token so the
 * application layer depends on this interface, not the concrete adapter.
 */
export interface PaymentGatewayPort {
  /** Whether a provider is configured (a secret key is present). */
  isEnabled(): boolean;
  /** Create a provider customer for a user and return its id. */
  createCustomer(params: { userId: string; email?: string }): Promise<string>;
  /** Create a hosted Checkout session and return its URL. */
  createCheckoutSession(params: CreateCheckoutParams): Promise<string>;
  /** Create a Customer Portal session and return its URL. */
  createPortalSession(params: CreatePortalParams): Promise<string>;
  /** Verify a webhook's signature and normalize it, or `{ type: 'ignored' }`. */
  constructEvent(payload: Buffer | string, signature: string): BillingWebhookEvent;
}
