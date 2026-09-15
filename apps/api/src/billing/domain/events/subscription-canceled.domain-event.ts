import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';

/**
 * Raised when a subscription transitions into the `canceled` state. Consumers
 * may react to revoke access, send a win-back email, or update analytics.
 */
export class SubscriptionCanceledDomainEvent extends DomainEvent {
  readonly userId: string;
  readonly stripeSubscriptionId: string;

  constructor(props: DomainEventProps<SubscriptionCanceledDomainEvent>) {
    super(props);
    this.userId = props.userId;
    this.stripeSubscriptionId = props.stripeSubscriptionId;
  }
}
