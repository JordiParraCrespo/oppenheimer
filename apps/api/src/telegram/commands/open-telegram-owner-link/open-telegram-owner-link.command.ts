import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class OpenTelegramOwnerLinkCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;

  constructor(props: CommandProps<OpenTelegramOwnerLinkCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
  }
}

/** The link, which only this request ever sees: the code is stored hashed. */
export interface OpenedTelegramOwnerLink {
  url: string;
  expiresAt: Date;
}
