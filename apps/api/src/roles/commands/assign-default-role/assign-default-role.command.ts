import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Give a newly created account the default application role.
 *
 * Dispatched by the Better Auth sign-up hook (`auth/auth.ts`), which creates
 * the account row itself — the role a person's permissions are actually read
 * from lives in the `user_role` join, not in Better Auth's `user.role` column.
 */
export class AssignDefaultRoleCommand extends CommandBase {
  readonly userId: string;

  constructor(props: CommandProps<AssignDefaultRoleCommand>) {
    super(props);
    this.userId = props.userId;
  }
}
