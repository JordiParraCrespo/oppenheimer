import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotApprovalDecision, Scope } from '@oppenheimer/shared';

export class DecideBotApprovalCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly approvalId: string;
  /** One of the card's `availableDecisions`, named (`namedBotApprovalDecision`). */
  readonly decision: BotApprovalDecision;
  /** What the person added: why they said no, or what to do instead. */
  readonly note: string | null;
  /** Who decided, as the bot is told: the caller's name. */
  readonly deciderName: string;
  /** The deciding credential's scopes; null for a browser session. */
  readonly credentialScopes: readonly Scope[] | null;

  constructor(props: CommandProps<DecideBotApprovalCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.approvalId = props.approvalId;
    this.decision = props.decision;
    this.note = props.note ?? null;
    this.deciderName = props.deciderName;
    this.credentialScopes = props.credentialScopes ?? null;
  }
}
