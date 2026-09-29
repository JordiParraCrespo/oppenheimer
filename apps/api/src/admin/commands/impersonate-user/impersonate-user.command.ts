import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class ImpersonateUserCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly userId: string;

  constructor(props: CommandProps<ImpersonateUserCommand>) {
    super(props);
    this.headers = props.headers;
    this.userId = props.userId;
  }
}
