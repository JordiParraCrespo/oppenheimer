import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Post the answer of a turn an ask on GitHub opened, on the issue or pull
 * request it was asked on; dispatched by the `bot-turns` worker from the job
 * the end of the turn staged.
 */
export class DeliverGithubAnswerCommand extends CommandBase {
  /** The turn, ended. */
  readonly turnId: string;

  constructor(props: CommandProps<DeliverGithubAnswerCommand>) {
    super(props);
    this.turnId = props.turnId;
  }
}
