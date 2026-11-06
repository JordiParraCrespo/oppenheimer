import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { Scope } from '@oppenheimer/shared';

/**
 * Raised when a bot is made, in the console or by another bot's `create_bot`.
 * The chat listens to give it a heartbeat (`26-bot-routines.md` §6): the
 * routine that wakes it on its own to check in.
 */
export class BotCreatedDomainEvent extends DomainEvent {
  readonly organizationId: string;
  /** Whose bot it is, and so whose routines it runs; null if that account is gone. */
  readonly createdByUserId: string | null;
  /**
   * The scopes of the credential that made it; null for a browser session.
   * What is saved for the bot at its birth keeps them, so a token reaches no
   * further through the bot's routines than through its own calls.
   */
  readonly credentialScopes: readonly Scope[] | null;

  constructor(props: DomainEventProps<BotCreatedDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.createdByUserId = props.createdByUserId;
    this.credentialScopes = props.credentialScopes;
  }
}
