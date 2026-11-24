import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotFormValues, Scope } from '@oppenheimer/shared';

export class SubmitBotFormCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly formId: string;
  /** A value per field id, as sent. */
  readonly values: Readonly<BotFormValues>;
  /** Who submitted, as the bot is told: the caller's name. */
  readonly deciderName: string;
  /** The submitting credential's scopes; null for a browser session. */
  readonly credentialScopes: readonly Scope[] | null;

  constructor(props: CommandProps<SubmitBotFormCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.formId = props.formId;
    this.values = props.values;
    this.deciderName = props.deciderName;
    this.credentialScopes = props.credentialScopes ?? null;
  }
}
