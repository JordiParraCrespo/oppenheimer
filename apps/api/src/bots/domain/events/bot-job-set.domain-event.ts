import { DomainEvent, type DomainEventProps } from '@oppenheimer/backend-ddd';
import type { Scope } from '@oppenheimer/shared';

/**
 * Raised when a bot's `INSTRUCTIONS.md` goes from empty to written: the bot
 * now has a job, at its creation or when it is first given one. The chat
 * listens to give it a heartbeat (`26-bot-routines.md` §6), the routine that
 * wakes it on its own to check in; a bot with no job has nothing to check.
 */
export class BotJobSetDomainEvent extends DomainEvent {
  readonly organizationId: string;
  readonly botId: string;
  /**
   * The scopes of the credential that wrote it; null for a browser session.
   * What is saved for the bot on the strength of it keeps them, so a token
   * reaches no further through the bot's routines than through its own calls.
   */
  readonly credentialScopes: readonly Scope[] | null;

  constructor(props: DomainEventProps<BotJobSetDomainEvent>) {
    super(props);
    this.organizationId = props.organizationId;
    this.botId = props.botId;
    this.credentialScopes = props.credentialScopes;
  }
}
