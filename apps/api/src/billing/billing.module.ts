import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BILLING_CUSTOMER_REPOSITORY,
  PAYMENT_GATEWAY,
  SUBSCRIPTION_REPOSITORY,
} from './billing.di-tokens';
import { BillingCustomerMapper } from './billing-customer.mapper';
import { CreateCheckoutHttpController } from './commands/create-checkout/create-checkout.http.controller';
import { CreateCheckoutService } from './commands/create-checkout/create-checkout.service';
import { CreatePortalHttpController } from './commands/create-portal/create-portal.http.controller';
import { CreatePortalService } from './commands/create-portal/create-portal.service';
import { HandleStripeWebhookHttpController } from './commands/handle-stripe-webhook/handle-stripe-webhook.http.controller';
import { HandleStripeWebhookService } from './commands/handle-stripe-webhook/handle-stripe-webhook.service';
import { BillingCustomerOrmEntity } from './database/billing-customer.orm-entity';
import { BillingCustomerRepository } from './database/billing-customer.repository';
import { SubscriptionOrmEntity } from './database/subscription.orm-entity';
import { SubscriptionRepository } from './database/subscription.repository';
import { StripePaymentGateway } from './infrastructure/stripe-payment.gateway';
import { FindSubscriptionsHttpController } from './queries/find-subscriptions/find-subscriptions.http.controller';
import { FindSubscriptionsQueryHandler } from './queries/find-subscriptions/find-subscriptions.query-handler';
import { GetMySubscriptionHttpController } from './queries/get-my-subscription/get-my-subscription.http.controller';
import { GetMySubscriptionQueryHandler } from './queries/get-my-subscription/get-my-subscription.query-handler';
import { GetRevenueMetricsHttpController } from './queries/get-revenue-metrics/get-revenue-metrics.http.controller';
import { GetRevenueMetricsQueryHandler } from './queries/get-revenue-metrics/get-revenue-metrics.query-handler';
import { SubscriptionMapper } from './subscription.mapper';

// Register static routes before parameterized ones (there are none here).
const httpControllers = [
  CreateCheckoutHttpController,
  CreatePortalHttpController,
  HandleStripeWebhookHttpController,
  GetMySubscriptionHttpController,
  FindSubscriptionsHttpController,
  GetRevenueMetricsHttpController,
];

const commandHandlers: Provider[] = [
  CreateCheckoutService,
  CreatePortalService,
  HandleStripeWebhookService,
];

const queryHandlers: Provider[] = [
  GetMySubscriptionQueryHandler,
  FindSubscriptionsQueryHandler,
  GetRevenueMetricsQueryHandler,
];

const mappers: Provider[] = [SubscriptionMapper, BillingCustomerMapper];

const repositories: Provider[] = [
  { provide: SUBSCRIPTION_REPOSITORY, useClass: SubscriptionRepository },
  { provide: BILLING_CUSTOMER_REPOSITORY, useClass: BillingCustomerRepository },
  { provide: PAYMENT_GATEWAY, useClass: StripePaymentGateway },
];

/**
 * Billing / subscriptions module (Stripe). Owns the subscription and
 * billing-customer aggregates, the Stripe payment gateway, and the checkout /
 * portal / webhook / subscription / revenue endpoints.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([SubscriptionOrmEntity, BillingCustomerOrmEntity]),
  ],
  controllers: [...httpControllers],
  providers: [...commandHandlers, ...queryHandlers, ...mappers, ...repositories],
  exports: [SUBSCRIPTION_REPOSITORY, BILLING_CUSTOMER_REPOSITORY, PAYMENT_GATEWAY],
})
export class BillingModule {}
