import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class LeaveOrganizationCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly organizationId: string;

  constructor(props: CommandProps<LeaveOrganizationCommand>) {
    super(props);
    this.headers = props.headers;
    this.organizationId = props.organizationId;
  }
}
