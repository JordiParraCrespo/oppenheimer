import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteAvatarCommand extends CommandBase {
  readonly userId: string;

  constructor(props: CommandProps<DeleteAvatarCommand>) {
    super(props);
    this.userId = props.userId;
  }
}
