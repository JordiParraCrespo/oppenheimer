import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ReactAsBotCommand extends CommandBase {
  /** The bot's owner's scope, as the turn holds it. */
  readonly scope: AccessScope;
  readonly organizationId: string;
  readonly botId: string;
  /** The conversation the turn runs in: a reaction lands only on one of its messages. */
  readonly conversationId: string;
  /** The turn reacting: with no `messageId`, it reacts to the message that opened it. */
  readonly turnId: string;
  readonly messageId: string | null;
  /** One emoji; null takes the bot's reaction back. */
  readonly emoji: string | null;

  constructor(props: CommandProps<ReactAsBotCommand>) {
    super(props);
    this.scope = props.scope;
    this.organizationId = props.organizationId;
    this.botId = props.botId;
    this.conversationId = props.conversationId;
    this.turnId = props.turnId;
    this.messageId = props.messageId ?? null;
    this.emoji = props.emoji;
  }
}
