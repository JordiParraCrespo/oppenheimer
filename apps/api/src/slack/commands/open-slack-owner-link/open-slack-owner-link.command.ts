import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class OpenSlackOwnerLinkCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;

  constructor(props: CommandProps<OpenSlackOwnerLinkCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
  }
}

/** The code's message and where to send it, which only this request ever sees: the code is stored hashed. */
export interface OpenedSlackOwnerLink {
  message: string;
  url: string;
  expiresAt: Date;
}
