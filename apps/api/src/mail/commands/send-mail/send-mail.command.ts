import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { MailPlan } from '@oppenheimer/shared';
import type { MailLocalFiles } from '../../domain/mail-send.policy';

/**
 * Sends a planned message, or a draft as the card showed it, from the
 * caller's Gmail, once per approval.
 */
export class SendMailCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly plan: MailPlan;
  /** The bytes of the plan's files held outside Gmail (images from the bot's chat). */
  readonly localFiles: MailLocalFiles;
  /** The approval the send carries out: what makes a retried job a no-op. */
  readonly approvalId: string;
  readonly botId: string | null;

  constructor(props: CommandProps<SendMailCommand>) {
    super(props);
    this.scope = props.scope;
    this.plan = props.plan;
    this.localFiles = props.localFiles;
    this.approvalId = props.approvalId;
    this.botId = props.botId;
  }
}
