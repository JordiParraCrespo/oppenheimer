import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * Carries the request headers because Better Auth resolves *which* session is
 * changing its password from them.
 */
export class ChangePasswordCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly userId: string;
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly revokeOtherSessions: boolean;

  constructor(props: CommandProps<ChangePasswordCommand>) {
    super(props);
    this.headers = props.headers;
    this.userId = props.userId;
    this.currentPassword = props.currentPassword;
    this.newPassword = props.newPassword;
    this.revokeOtherSessions = props.revokeOtherSessions;
  }
}
