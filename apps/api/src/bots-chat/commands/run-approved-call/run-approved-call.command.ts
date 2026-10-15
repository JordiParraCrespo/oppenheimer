import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Carry out one approved call; dispatched by the `bot-approvals` worker. */
export class RunApprovedCallCommand extends CommandBase {
  readonly approvalId: string;
  /** Who approved it, by name, as the bot is told. */
  readonly by: string;

  constructor(props: CommandProps<RunApprovedCallCommand>) {
    super(props);
    this.approvalId = props.approvalId;
    this.by = props.by;
  }
}
