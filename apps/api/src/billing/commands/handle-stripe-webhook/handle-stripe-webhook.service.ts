import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  BILLING_CUSTOMER_REPOSITORY,
  PAYMENT_GATEWAY,
  SUBSCRIPTION_REPOSITORY,
} from '../../billing.di-tokens';
import type { BillingCustomerRepositoryPort } from '../../database/billing-customer.repository.port';
import type { SubscriptionRepositoryPort } from '../../database/subscription.repository.port';
import { BillingCustomerEntity } from '../../domain/billing-customer.entity';
import { SubscriptionEntity } from '../../domain/subscription.entity';
import type {
  NormalizedSubscription,
  PaymentGatewayPort,
} from '../../infrastructure/payment-gateway.port';
import { isUniqueViolation } from '../../infrastructure/postgres-error.util';
import { SubscriptionMapper } from '../../subscription.mapper';
import { HandleStripeWebhookCommand } from './handle-stripe-webhook.command';

/**
 * Verifies a Stripe webhook and upserts the local subscription mirror. The
 * signature is checked inside the gateway; only recognized subscription events
 * mutate state, and the upsert is idempotent (safe to receive twice).
 */
@CommandHandler(HandleStripeWebhookCommand)
export class HandleStripeWebhookService
  implements ICommandHandler<HandleStripeWebhookCommand, void>
{
  private readonly logger = new Logger(HandleStripeWebhookService.name);

  constructor(
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGatewayPort,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepositoryPort,
    @Inject(BILLING_CUSTOMER_REPOSITORY)
    private readonly customers: BillingCustomerRepositoryPort,
    private readonly mapper: SubscriptionMapper,
  ) {}

  async execute(command: HandleStripeWebhookCommand): Promise<void> {
    const event = this.gateway.constructEvent(command.payload, command.signature);
    if (event.type === 'ignored') return;

    const data = event.data;
    const userId = await this.resolveUserId(data);
    if (!userId) {
      this.logger.warn(
        `Ignoring subscription webhook for unmapped customer ${data.stripeCustomerId}`,
      );
      return;
    }

    const existing = await this.subscriptions.findOneByStripeId(data.stripeSubscriptionId);
    if (existing.isSome()) {
      await this.applySync(existing.unwrap(), data);
      return;
    }

    const subscription = SubscriptionEntity.createNew({
      userId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      ...this.mapper.toSyncProps(data),
    });
    try {
      await this.subscriptions.insert(subscription);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // A concurrent duplicate delivery inserted this subscription between our
      // lookup and insert. Reconcile against the now-existing row instead of
      // surfacing an unmapped 500 (the check-then-insert is not transactional).
      const raced = await this.subscriptions.findOneByStripeId(data.stripeSubscriptionId);
      if (raced.isSome()) await this.applySync(raced.unwrap(), data);
    }
  }

  /**
   * Apply the webhook state to an existing subscription, persisting only when
   * `sync()` actually changed something (it discards out-of-order/stale events).
   */
  private async applySync(
    subscription: SubscriptionEntity,
    data: NormalizedSubscription,
  ): Promise<void> {
    if (subscription.sync(this.mapper.toSyncProps(data))) {
      await this.subscriptions.save(subscription);
    }
  }

  /**
   * Map a Stripe customer back to a Oppenheimer user. Prefers the persisted
   * `billing_customer` mapping and falls back to the `userId` carried in the
   * subscription metadata (set at checkout), persisting the mapping for later.
   */
  private async resolveUserId(data: NormalizedSubscription): Promise<string | null> {
    const customer = await this.customers.findOneByStripeCustomerId(data.stripeCustomerId);
    if (customer.isSome()) return customer.unwrap().userId;

    if (data.userId) {
      await this.customers.insert(
        BillingCustomerEntity.createNew({
          userId: data.userId,
          stripeCustomerId: data.stripeCustomerId,
        }),
      );
      return data.userId;
    }
    return null;
  }
}
