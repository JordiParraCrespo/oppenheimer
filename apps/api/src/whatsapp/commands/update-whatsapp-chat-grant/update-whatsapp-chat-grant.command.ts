import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UpdateWhatsappChatGrantCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;
  readonly grantId: string;
  /** The bot that answers in the chat; null for the number's default. */
  readonly botId: string | null;

  constructor(props: CommandProps<UpdateWhatsappChatGrantCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
    this.grantId = props.grantId;
    this.botId = props.botId;
  }
}
