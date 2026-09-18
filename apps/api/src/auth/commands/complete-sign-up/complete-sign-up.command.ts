import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * An account has just been created; give it everything sign-up owes it.
 *
 * One command, not one per side effect, so the Better Auth hook that raises it
 * says *that sign-up finished* and nothing about how it is fulfilled. Adding a
 * side effect is then a change to this command's handler, not another import
 * and another dispatch in a file of Better Auth configuration that cannot
 * inject anything.
 */
export class CompleteSignUpCommand extends CommandBase {
  readonly userId: string;
  readonly email: string;
  readonly name?: string | null;

  constructor(props: CommandProps<CompleteSignUpCommand>) {
    super(props);
    this.userId = props.userId;
    this.email = props.email;
    this.name = props.name;
  }
}
