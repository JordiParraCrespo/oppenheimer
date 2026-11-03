import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { PullRequestWakeEvent } from '@oppenheimer/shared';

/**
 * Wake a bot for an event on a pull request it follows
 * (`27-bot-subscriptions.md` §7); dispatched for each subscription to the
 * pull request a stored GitHub event names. It carries the event's metadata
 * only: its context (a comment's words) never leaves the inbound store.
 */
export class WakeOnPullRequestCommand extends CommandBase {
  readonly subscriptionId: string;
  /** The stored inbound event: one turn per event, however often it is delivered. */
  readonly inboundEventId: string;
  readonly type: PullRequestWakeEvent;
  readonly attributes: Record<string, unknown>;
  readonly actorLogin: string | null;

  constructor(props: CommandProps<WakeOnPullRequestCommand>) {
    super(props);
    this.subscriptionId = props.subscriptionId;
    this.inboundEventId = props.inboundEventId;
    this.type = props.type;
    this.attributes = props.attributes;
    this.actorLogin = props.actorLogin;
  }
}
