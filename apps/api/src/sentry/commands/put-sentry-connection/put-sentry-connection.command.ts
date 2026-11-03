import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class PutSentryConnectionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly organizationSlug: string;
  readonly clientSecret: string;

  constructor(props: CommandProps<PutSentryConnectionCommand>) {
    super(props);
    this.scope = props.scope;
    this.organizationSlug = props.organizationSlug;
    this.clientSecret = props.clientSecret;
  }
}
