import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { CreateOrganizationDto } from '@oppenheimer/shared';

export class CreateOrganizationCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly input: CreateOrganizationDto;
  readonly creatorId: string | undefined;

  constructor(props: CommandProps<CreateOrganizationCommand>) {
    super(props);
    this.headers = props.headers;
    this.input = props.input;
    this.creatorId = props.creatorId;
  }
}
