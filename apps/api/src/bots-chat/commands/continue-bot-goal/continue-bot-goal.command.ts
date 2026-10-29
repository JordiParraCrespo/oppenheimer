import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * A turn of a bot with a goal ended: queue the goal's next continuation, or
 * end the goal (`25-bots.md` §4.1). Dispatched by the `bot-turns` worker from
 * the job the turn's end staged.
 */
export class ContinueBotGoalCommand extends CommandBase {
  /** The turn that ended. */
  readonly turnId: string;

  constructor(props: CommandProps<ContinueBotGoalCommand>) {
    super(props);
    this.turnId = props.turnId;
  }
}
