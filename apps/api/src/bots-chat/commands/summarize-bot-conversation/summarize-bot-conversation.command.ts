import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Fold a bot's oldest uncovered messages into its summary; dispatched by the `bot-summaries` worker. */
export class SummarizeBotConversationCommand extends CommandBase {
  readonly organizationId: string;
  readonly botId: string;

  constructor(props: CommandProps<SummarizeBotConversationCommand>) {
    super(props);
    this.organizationId = props.organizationId;
    this.botId = props.botId;
  }
}
