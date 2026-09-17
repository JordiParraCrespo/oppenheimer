import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Give an account the workspace it works in.
 *
 * Dispatched by the Better Auth sign-up hook (`auth/auth.ts`) and by the seed.
 * It carries the account rather than an id alone because the workspace is
 * named after the person, and the hook already holds the freshly created row.
 */
export class ProvisionPersonalWorkspaceCommand extends CommandBase {
  readonly userId: string;
  readonly email: string;
  readonly name?: string | null;

  constructor(props: CommandProps<ProvisionPersonalWorkspaceCommand>) {
    super(props);
    this.userId = props.userId;
    this.email = props.email;
    this.name = props.name;
  }
}
