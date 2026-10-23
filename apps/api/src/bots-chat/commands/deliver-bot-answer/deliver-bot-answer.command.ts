import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Queue the answer of an ask on the bot that asked (`25-bots.md` §4.6), once
 * the asked turn ended; dispatched by the `bot-turns` worker from the job the
 * end of that turn staged.
 */
export class DeliverBotAnswerCommand extends CommandBase {
  /** The asked turn, ended. */
  readonly turnId: string;

  constructor(props: CommandProps<DeliverBotAnswerCommand>) {
    super(props);
    this.turnId = props.turnId;
  }
}
