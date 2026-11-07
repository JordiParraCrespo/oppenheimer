import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * A loop's run came due (`25-bots.md` §4.1, `/loop`): queue it, skip it, or
 * end the loop. Dispatched by the `bot-turns` worker from the delayed job the
 * loop staged for that run.
 */
export class RunBotLoopCommand extends CommandBase {
  readonly loopId: string;
  /** The loop's count of queued runs once this one is queued. */
  readonly run: number;
  /** When it was due, as the loop held it when the job was staged. */
  readonly at: Date;

  constructor(props: CommandProps<RunBotLoopCommand>) {
    super(props);
    this.loopId = props.loopId;
    this.run = props.run;
    this.at = props.at;
  }
}
