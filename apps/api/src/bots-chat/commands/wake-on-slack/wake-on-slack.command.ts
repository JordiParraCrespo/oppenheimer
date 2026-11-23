import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * The owner asked their bot in Slack, by a mention or in its DM: a turn in
 * the thread's conversation (`message`), or its running turn stopped
 * (`stop`). Dispatched once per message Slack delivered.
 */
export class WakeOnSlackCommand extends CommandBase {
  readonly organizationId: string;
  /** The bot's maker, whose Slack user asked; the bot answers only them. */
  readonly userId: string;
  readonly botId: string;
  readonly slackAccountId: string;
  readonly channel: string;
  /** The thread the answer goes in: `<channel>:<thread ts>`. */
  readonly chatId: string;
  /** The message's own timestamp, and the same as a position in the channel. */
  readonly ts: string;
  readonly position: string;
  readonly command: 'message' | 'stop';
  readonly text: string;

  constructor(props: CommandProps<WakeOnSlackCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.botId = props.botId;
    this.slackAccountId = props.slackAccountId;
    this.channel = props.channel;
    this.chatId = props.chatId;
    this.ts = props.ts;
    this.position = props.position;
    this.command = props.command;
    this.text = props.text;
  }
}
