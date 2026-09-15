import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a subscription enters an active/trialing state (a new paying
 * customer, or a reactivation). Consumers may react to provision access,
 * send a receipt, or update analytics.
 */
export class SubscriptionActivatedDomainEvent extends DomainEvent {
  readonly userId: string;
  readonly stripeSubscriptionId: string;
  readonly plan: string | null;

  constructor(props: DomainEventProps<SubscriptionActivatedDomainEvent>) {
    super(props);
    this.userId = props.userId;
    this.stripeSubscriptionId = props.stripeSubscriptionId;
    this.plan = props.plan;
  }
}
