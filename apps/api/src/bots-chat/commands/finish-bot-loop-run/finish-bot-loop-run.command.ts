import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * A run of a bot's loop ended: the loop goes on, ends, or tries a self-paced
 * run again (`25-bots.md` §4.1, `/loop`). Dispatched by the `bot-turns`
 * worker from the job the turn's end staged.
 */
export class FinishBotLoopRunCommand extends CommandBase {
  /** The turn that ended. */
  readonly turnId: string;

  constructor(props: CommandProps<FinishBotLoopRunCommand>) {
    super(props);
    this.turnId = props.turnId;
  }
}
