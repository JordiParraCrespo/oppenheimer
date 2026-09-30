import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Give a newly created account the default application role.
 *
 * Dispatched on sign-up by `CompleteSignUpCommandHandler` and by the seed:
 * Better Auth creates the account row, but the role a person's permissions are
 * read from lives in the `user_role` join, not in Better Auth's `user.role`
 * column.
 */
export class AssignDefaultRoleCommand extends CommandBase {
  readonly userId: string;

  constructor(props: CommandProps<AssignDefaultRoleCommand>) {
    super(props);
    this.userId = props.userId;
  }
}
