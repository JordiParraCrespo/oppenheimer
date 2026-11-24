import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** One request Slack sent a bot's events address, unread until its signature is checked. */
export class ReceiveSlackEventCommand extends CommandBase {
  /** The bot the address names (`?bot=`). */
  readonly botId: string;
  readonly timestamp: string;
  readonly signature: string;
  readonly body: Buffer;

  constructor(props: CommandProps<ReceiveSlackEventCommand>) {
    super(props);
    this.botId = props.botId;
    this.timestamp = props.timestamp;
    this.signature = props.signature;
    this.body = props.body;
  }
}

/** What the route answers Slack: the challenge of a `url_verification`, else nothing. */
export interface ReceivedSlackEvent {
  challenge?: string;
}
