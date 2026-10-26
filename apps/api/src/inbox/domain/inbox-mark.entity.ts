import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { INBOX_MARKS, type InboxMark } from '@oppenheimer/shared';
import { InboxMarkChangedDomainEvent } from './events/inbox-mark-changed.domain-event';
import { inboxMarkProblem } from './inbox-mark.policy';

export interface InboxMarkProps {
  organizationId: string;
  /** Whose mark it is: a mark is a person's, even in a shared workspace. */
  userId: string;
  /** The occurrence it answers (`approval:<id>`, `session:<id>:<observedSince>`…). */
  itemKey: string;
  mark: InboxMark;
  /** When a snooze ends; null for every other mark. */
  until: Date | null;
}

/**
 * What a person did to one occurrence of an Inbox item
 * (`product/versions/mvp/28-inbox.md` §3): done, low, snoozed until a time,
 * or deleted. One per person, workspace and occurrence; setting it again
 * replaces it, and removing it brings the item back as it was.
 */
export class InboxMarkEntity extends AggregateRoot<InboxMarkProps> {
  static create(create: CreateEntityProps<InboxMarkProps>): InboxMarkEntity {
    return new InboxMarkEntity(create);
  }

  /**
   * The person marks the occurrence, as of `now`: a snooze must end after it.
   * Whether the occurrence was marked before is the store's to settle.
   */
  static place(props: InboxMarkProps, now: Date): InboxMarkEntity {
    const mark = new InboxMarkEntity({ id: randomUUID(), props: { ...props } });
    mark.validate();
    if (inboxMarkProblem(props, now) === 'until_past') {
      throw new ArgumentInvalidException('A snooze ends in the future');
    }
    mark.announce(`marked ${props.mark}`);
    return mark;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get userId(): string {
    return this.props.userId;
  }
  get itemKey(): string {
    return this.props.itemKey;
  }
  get mark(): InboxMark {
    return this.props.mark;
  }
  get until(): Date | null {
    return this.props.until;
  }

  /** Bring back, or restore priority: the mark goes, and the item is as it was. */
  remove(): void {
    this.announce('mark removed');
  }

  private announce(what: string): void {
    this.addEvent(
      new InboxMarkChangedDomainEvent({
        aggregateId: this.id,
        organizationId: this.props.organizationId,
        userId: this.props.userId,
        itemKey: this.props.itemKey,
        reason: `inbox ${this.props.userId}: ${this.props.itemKey} ${what}`,
      }),
    );
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.userId) {
      throw new ArgumentNotProvidedException('A mark is a person’s, in a workspace');
    }
    if (!INBOX_MARKS.includes(props.mark)) {
      throw new ArgumentInvalidException(`${props.mark} is not an Inbox mark`);
    }
    // A stored snooze may have ended: only the shape is the entity's to hold.
    const problem = inboxMarkProblem(props, new Date(0));
    if (problem === 'item_key') throw new ArgumentInvalidException('Not an Inbox item key');
    if (problem === 'until_missing') throw new ArgumentInvalidException('A snooze needs an end');
    if (problem === 'until_unexpected') {
      throw new ArgumentInvalidException('Only a snooze has an end');
    }
  }
}
