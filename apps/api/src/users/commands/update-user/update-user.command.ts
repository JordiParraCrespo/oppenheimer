import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UpdateUserCommand extends CommandBase {
  readonly userId: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly isActive?: boolean;

  constructor(props: CommandProps<UpdateUserCommand>) {
    super(props);
    this.userId = props.userId;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.isActive = props.isActive;
  }
}
