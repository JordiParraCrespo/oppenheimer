import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { Scope } from '@oppenheimer/shared';

export class SendBotMessageCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly content: string;
  /** The sender's IANA time zone; null means UTC. */
  readonly timeZone: string | null;
  /** The scopes of the credential it was sent with; null for a browser session. */
  readonly credentialScopes: readonly Scope[] | null;

  constructor(props: CommandProps<SendBotMessageCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.content = props.content;
    this.timeZone = props.timeZone ?? null;
    this.credentialScopes = props.credentialScopes ?? null;
  }
}
