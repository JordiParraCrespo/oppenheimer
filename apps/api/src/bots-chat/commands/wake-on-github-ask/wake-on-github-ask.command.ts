import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotGithubAskVia } from '@oppenheimer/shared';

/**
 * Wake the bot an ask on GitHub names, if its owner asked; dispatched for
 * every stored GitHub mention and `bot:` label. It carries the event's
 * metadata; what was written is read from the inbound store, once the
 * asker is known to be the owner.
 */
export class WakeOnGithubAskCommand extends CommandBase {
  readonly organizationId: string;
  /** The stored inbound event: one turn per event, however often it is delivered. */
  readonly inboundEventId: string;
  readonly via: BotGithubAskVia;

  constructor(props: CommandProps<WakeOnGithubAskCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.inboundEventId = props.inboundEventId;
    this.via = props.via;
  }
}
