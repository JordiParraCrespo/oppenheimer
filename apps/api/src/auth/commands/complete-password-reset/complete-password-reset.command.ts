import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * An account's password has just been reset; take back every credential
 * issued before it. Raised by Better Auth's `onPasswordReset` ("Forgot
 * password"), which says only *that* the reset happened, and by an
 * administrator's set-password (`SetUserPasswordCommandHandler`).
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
