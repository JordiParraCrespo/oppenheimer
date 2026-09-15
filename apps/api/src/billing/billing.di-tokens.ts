/**
 * DI tokens for the billing module. Repositories and the payment gateway are
 * injected through tokens so application code depends on the port abstractions,
 * not the concrete TypeORM / Stripe adapters.
 */
export const SUBSCRIPTION_REPOSITORY = Symbol('SUBSCRIPTION_REPOSITORY');
export const BILLING_CUSTOMER_REPOSITORY = Symbol('BILLING_CUSTOMER_REPOSITORY');
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
