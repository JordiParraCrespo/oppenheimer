import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * An account's password has just been reset through "Forgot password"; take
 * back every credential issued before it. Raised by Better Auth's
 * `onPasswordReset`, which says only *that* the reset happened.
 */
export class CompletePasswordResetCommand extends CommandBase {
  readonly userId: string;
  readonly resetAt: Date;

  constructor(props: CommandProps<CompletePasswordResetCommand>) {
    super(props);
    this.userId = props.userId;
    this.resetAt = props.resetAt;
  }
}
