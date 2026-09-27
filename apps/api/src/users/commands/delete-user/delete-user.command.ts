import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class DeleteUserCommand extends CommandBase {
  readonly userId: string;
  /**
   * What the person typed to confirm deleting their own account, which must
   * be its email. Absent on the admin path, where the policy is the check.
   */
  readonly confirmation?: string;

  constructor(props: CommandProps<DeleteUserCommand>) {
    super(props);
    this.userId = props.userId;
    this.confirmation = props.confirmation;
  }
}
