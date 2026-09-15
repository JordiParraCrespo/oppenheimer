import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteUserCommand extends CommandBase {
  readonly userId: string;

  constructor(props: CommandProps<DeleteUserCommand>) {
    super(props);
    this.userId = props.userId;
  }
}
