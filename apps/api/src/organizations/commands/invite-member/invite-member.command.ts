import type { IncomingHttpHeaders } from 'node:http';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { InviteMemberDto } from '@oppenheimer/shared';

export class InviteMemberCommand extends CommandBase {
  readonly headers: IncomingHttpHeaders;
  readonly organizationId: string;
  readonly input: InviteMemberDto;

  constructor(props: CommandProps<InviteMemberCommand>) {
    super(props);
    this.headers = props.headers;
    this.organizationId = props.organizationId;
    this.input = props.input;
  }
}
