import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ReactToBotMessageCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly messageId: string;
  /** One emoji; null takes the reaction back. */
  readonly emoji: string | null;

  constructor(props: CommandProps<ReactToBotMessageCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.messageId = props.messageId;
    this.emoji = props.emoji;
  }
}
