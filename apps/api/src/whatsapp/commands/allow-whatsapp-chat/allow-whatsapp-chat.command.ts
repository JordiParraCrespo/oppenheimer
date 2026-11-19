import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class AllowWhatsappChatCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;
  /** The chat: its id, its name, or a person's phone number in international form. */
  readonly chat: string;
  /** The bot that answers there; null for the number's default; absent leaves an allowed chat's as it is. */
  readonly botId: string | null | undefined;
  /** The bot whose tool allows it, in the owner's own chat with it; null from Settings. */
  readonly grantedByBotId: string | null;

  constructor(props: CommandProps<AllowWhatsappChatCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
    this.chat = props.chat;
    this.botId = props.botId;
    this.grantedByBotId = props.grantedByBotId;
  }
}
