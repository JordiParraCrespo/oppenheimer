import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { BotApprovalStatus } from '@oppenheimer/shared';

/**
 * Raised when an approval is written in a new state: raised (`pending`),
 * decided, expired, or its call's result recorded. The workspace stream
 * announces it, so the Inbox's pending approvals move without a poll
 * (`product/versions/mvp/29-inbox.md` §4).
 */
export class BotApprovalChangedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly botId: string;
  readonly status: BotApprovalStatus;

  constructor(props: DomainEventProps<BotApprovalChangedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.botId = props.botId;
    this.status = props.status;
  }
}
