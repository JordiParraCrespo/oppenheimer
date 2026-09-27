import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Asks to move the caller's account to another address. Carries the request
 * headers for the same reason `ChangePasswordCommand` does: Better Auth
 * resolves the session making the change from them.
 */
export class ChangeEmailCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly userId: string;
  readonly newEmail: string;
  /** The client's own screen to return to once the link is followed. */
  readonly callbackURL?: string;

  constructor(props: CommandProps<ChangeEmailCommand>) {
    super(props);
    this.headers = props.headers;
    this.userId = props.userId;
    this.newEmail = props.newEmail;
    this.callbackURL = props.callbackURL;
  }
}
