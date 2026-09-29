import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UpdateMemberRoleCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly organizationId: string;
  readonly memberId: string;
  readonly role: string;

  constructor(props: CommandProps<UpdateMemberRoleCommand>) {
    super(props);
    this.headers = props.headers;
    this.organizationId = props.organizationId;
    this.memberId = props.memberId;
    this.role = props.role;
  }
}
