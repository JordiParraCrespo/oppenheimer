import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AdminCreateUserDto } from '@oppenheimer/shared';

export class CreateUserCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly input: AdminCreateUserDto;

  constructor(props: CommandProps<CreateUserCommand>) {
    super(props);
    this.headers = props.headers;
    this.input = props.input;
  }
}
