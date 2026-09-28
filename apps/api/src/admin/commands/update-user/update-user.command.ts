import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AdminUpdateUserDto } from '@oppenheimer/shared';

export class UpdateUserCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly userId: string;
  readonly data: AdminUpdateUserDto;

  constructor(props: CommandProps<UpdateUserCommand>) {
    super(props);
    this.headers = props.headers;
    this.userId = props.userId;
    this.data = props.data;
  }
}
