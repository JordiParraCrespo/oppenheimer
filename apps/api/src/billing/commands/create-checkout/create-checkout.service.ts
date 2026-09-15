import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ACTIVE_SUBSCRIPTION_STATUSES } from '@oppenheimer/shared';
import {
  BILLING_CUSTOMER_REPOSITORY,
  PAYMENT_GATEWAY,
  SUBSCRIPTION_REPOSITORY,
} from '../../billing.di-tokens';
import type { BillingCustomerRepositoryPort } from '../../database/billing-customer.repository.port';
import type { SubscriptionRepositoryPort } from '../../database/subscription.repository.port';
import { BillingErrors } from '../../domain/billing.errors';
import { BillingCustomerEntity } from '../../domain/billing-customer.entity';
import type { PaymentGatewayPort } from '../../infrastructure/payment-gateway.port';
import { CreateCheckoutCommand } from './create-checkout.command';

const ACTIVE_STATUSES = new Set<string>(ACTIVE_SUBSCRIPTION_STATUSES);

/**
 * Ensures the user has a Stripe customer (creating + persisting the mapping on
 * first use) and opens a hosted Checkout session. Returns the Stripe URL for
 * the controller to hand back to the browser.
 */
@CommandHandler(CreateCheckoutCommand)
export class CreateCheckoutService implements ICommandHandler<CreateCheckoutCommand, string> {
  constructor(
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGatewayPort,
    @Inject(BILLING_CUSTOMER_REPOSITORY)
    private readonly customers: BillingCustomerRepositoryPort,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepositoryPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: CreateCheckoutCommand): Promise<string> {
    // Guard against double-subscribing: if the user already has a live
    // subscription, opening another subscription-mode Checkout would create a
    // second Stripe subscription and double-bill them. Send them to the portal.
    const current = await this.subscriptions.findOneByUserId(command.userId);
    if (current.isSome() && ACTIVE_STATUSES.has(current.unwrap().status)) {
      throw new AppError(BillingErrors.ALREADY_SUBSCRIBED);
    }

    const customerId = await this.ensureCustomer(command.userId, command.email);

    return this.gateway.createCheckoutSession({
      customerId,
      priceId: command.priceId,
      userId: command.userId,
      successUrl: command.successUrl ?? this.defaultSuccessUrl,
      cancelUrl: command.cancelUrl ?? this.defaultCancelUrl,
    });
  }

  /** Resolve the user's Stripe customer id, creating + persisting it if needed. */
  private async ensureCustomer(userId: string, email?: string): Promise<string> {
    const existing = await this.customers.findOneByUserId(userId);
    if (existing.isSome()) return existing.unwrap().stripeCustomerId;

    const stripeCustomerId = await this.gateway.createCustomer({
      userId,
      email,
    });
    await this.customers.insert(BillingCustomerEntity.createNew({ userId, stripeCustomerId }));
    return stripeCustomerId;
  }

  private get frontendUrl(): string {
    return this.configService.get<string>('app.frontendUrl') ?? '';
  }

  private get defaultSuccessUrl(): string {
    return (
      this.configService.get<string>('stripe.successUrl') ??
      `${this.frontendUrl}/billing?status=success`
    );
  }

  private get defaultCancelUrl(): string {
    return (
      this.configService.get<string>('stripe.cancelUrl') ??
      `${this.frontendUrl}/billing?status=cancelled`
    );
  }
}
