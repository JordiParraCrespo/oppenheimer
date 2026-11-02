import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { Scope } from '@oppenheimer/shared';

export class DismissBotQuestionCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly questionId: string;
  /** What the person added: why not, or what to do instead. */
  readonly note: string | null;
  /** Who dismissed, as the bot is told: the caller's name. */
  readonly deciderName: string;
  /** The dismissing credential's scopes; null for a browser session. */
  readonly credentialScopes: readonly Scope[] | null;

  constructor(props: CommandProps<DismissBotQuestionCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.questionId = props.questionId;
    this.note = props.note ?? null;
    this.deciderName = props.deciderName;
    this.credentialScopes = props.credentialScopes ?? null;
  }
}
