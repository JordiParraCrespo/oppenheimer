import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class BanUserCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly userId: string;
  readonly banReason: string | undefined;
  readonly banExpiresIn: number | undefined;

  constructor(props: CommandProps<BanUserCommand>) {
    super(props);
    this.headers = props.headers;
    this.userId = props.userId;
    this.banReason = props.banReason;
    this.banExpiresIn = props.banExpiresIn;
  }
}
