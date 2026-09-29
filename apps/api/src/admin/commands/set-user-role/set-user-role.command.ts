import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class SetUserRoleCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly userId: string;
  readonly role: string | string[];

  constructor(props: CommandProps<SetUserRoleCommand>) {
    super(props);
    this.headers = props.headers;
    this.userId = props.userId;
    this.role = props.role;
  }
}
