import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { WhatsappChatRoute } from '@oppenheimer/shared';

/** Who answers a set of one of the caller's numbers' chats from now on. */
export class RouteWhatsappChatsCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;
  readonly chatIds: readonly string[];
  readonly route: WhatsappChatRoute;
  /** The bot, with the `bot` route; null otherwise. */
  readonly botId: string | null;

  constructor(props: CommandProps<RouteWhatsappChatsCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
    this.chatIds = props.chatIds;
    this.route = props.route;
    this.botId = props.botId;
  }
}
