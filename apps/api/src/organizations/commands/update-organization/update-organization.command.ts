import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { UpdateOrganizationDto } from '@oppenheimer/shared';

export class UpdateOrganizationCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly organizationId: string;
  readonly data: UpdateOrganizationDto;

  constructor(props: CommandProps<UpdateOrganizationCommand>) {
    super(props);
    this.headers = props.headers;
    this.organizationId = props.organizationId;
    this.data = props.data;
  }
}
