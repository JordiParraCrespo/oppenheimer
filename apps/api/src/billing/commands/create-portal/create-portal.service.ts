import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { BILLING_CUSTOMER_REPOSITORY, PAYMENT_GATEWAY } from '../../billing.di-tokens';
import type { BillingCustomerRepositoryPort } from '../../database/billing-customer.repository.port';
import { BillingErrors } from '../../domain/billing.errors';
import type { PaymentGatewayPort } from '../../infrastructure/payment-gateway.port';
import { CreatePortalCommand } from './create-portal.command';

/**
 * Opens a Stripe Customer Portal session so the user can manage or cancel their
 * subscription. Returns the Stripe URL for the controller to redirect to.
 */
@CommandHandler(CreatePortalCommand)
export class CreatePortalService implements ICommandHandler<CreatePortalCommand, string> {
  constructor(
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGatewayPort,
    @Inject(BILLING_CUSTOMER_REPOSITORY)
    private readonly customers: BillingCustomerRepositoryPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: CreatePortalCommand): Promise<string> {
    const customer = await this.customers.findOneByUserId(command.userId);
    if (customer.isNone()) throw new AppError(BillingErrors.CUSTOMER_NOT_FOUND);

    return this.gateway.createPortalSession({
      customerId: customer.unwrap().stripeCustomerId,
      returnUrl: command.returnUrl ?? this.defaultReturnUrl,
    });
  }

  private get frontendUrl(): string {
    return this.configService.get<string>('app.frontendUrl') ?? '';
  }

  private get defaultReturnUrl(): string {
    return (
      this.configService.get<string>('stripe.portalReturnUrl') ?? `${this.frontendUrl}/billing`
    );
  }
}
