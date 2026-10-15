import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Run one queued turn; dispatched by the `bot-turns` worker. */
export class RunBotTurnCommand extends CommandBase {
  readonly turnId: string;

  constructor(props: CommandProps<RunBotTurnCommand>) {
    super(props);
    this.turnId = props.turnId;
  }
}
