import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Send an Oppenheimer bot's answer in the Slack thread it was asked in,
 * through the bot's own app: the reply to the owner's message, not a tool's
 * send, so it asks nothing.
 */
export class ReplyOnSlackCommand extends CommandBase {
  readonly organizationId: string;
  readonly accountId: string;
  /** The conversation's chat: `<channel>:<thread ts>`. */
  readonly chatId: string;
  readonly text: string;
  /** The Oppenheimer bot that wrote it: it must still be the app's. */
  readonly botId: string;

  constructor(props: CommandProps<ReplyOnSlackCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.accountId = props.accountId;
    this.chatId = props.chatId;
    this.text = props.text;
    this.botId = props.botId;
  }
}
