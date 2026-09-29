import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class SetUserPasswordCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly userId: string;
  readonly newPassword: string;

  constructor(props: CommandProps<SetUserPasswordCommand>) {
    super(props);
    this.headers = props.headers;
    this.userId = props.userId;
    this.newPassword = props.newPassword;
  }
}
