import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Put the working reaction on the owner's Slack message a bot's turn has
 * started on, through the bot's own app. It is the turn's own message, so a
 * message folded into a turn already running, or one that never became a
 * turn, gets none. The turn's last answer takes it off (`ReplyOnSlackCommand`).
 */
export class MarkSlackWorkingCommand extends CommandBase {
  readonly organizationId: string;
  readonly accountId: string;
  /** The conversation's chat: `<channel>:<thread ts>`. */
  readonly chatId: string;
  /** The Slack timestamp of the owner's message the turn is on. */
  readonly ts: string;
  /** The Oppenheimer bot whose turn it is: it must still be the app's. */
  readonly botId: string;

  constructor(props: CommandProps<MarkSlackWorkingCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.accountId = props.accountId;
    this.chatId = props.chatId;
    this.ts = props.ts;
    this.botId = props.botId;
  }
}
