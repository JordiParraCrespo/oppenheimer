import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** What a bot's reaction on Slack came to (`ReactOnSlackCommandHandler`). */
export type SlackReactOutcome = 'reacted' | 'not_sent' | 'no_name' | 'working_sign';

/**
 * Put an Oppenheimer bot's reaction on the owner's Slack message, through the
 * bot's own app, in the thread it answers: one at a time, so `previous` (the
 * bot's reaction there before) comes off. Null `emoji` only takes it back.
 */
export class ReactOnSlackCommand extends CommandBase {
  readonly organizationId: string;
  readonly accountId: string;
  /** The conversation's chat: `<channel>:<thread ts>`. */
  readonly chatId: string;
  /** The Slack timestamp of the owner's message reacted to. */
  readonly ts: string;
  /** The Oppenheimer bot reacting: it must still be the app's. */
  readonly botId: string;
  readonly emoji: string | null;
  readonly previous: string | null;

  constructor(props: CommandProps<ReactOnSlackCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.accountId = props.accountId;
    this.chatId = props.chatId;
    this.ts = props.ts;
    this.botId = props.botId;
    this.emoji = props.emoji;
    this.previous = props.previous;
  }
}
