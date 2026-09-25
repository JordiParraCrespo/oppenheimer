import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteFlagSegmentCommand extends CommandBase {
  readonly key: string;
  readonly actorId: string | null;
  readonly comment?: string;

  constructor(props: CommandProps<DeleteFlagSegmentCommand>) {
    super(props);
    this.key = props.key;
    this.actorId = props.actorId;
    this.comment = props.comment;
  }
}
