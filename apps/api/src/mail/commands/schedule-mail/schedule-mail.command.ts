import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { MailPlan } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/** Keeps an approved message to send from the caller's Gmail at a time, once per approval. */
export class ScheduleMailCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly plan: MailPlan;
  readonly sendAt: Date;
  /** The approval that scheduled it: a retried job finds the same scheduled send. */
  readonly approvalId: string;
  readonly botId: string | null;

  constructor(props: CommandProps<ScheduleMailCommand>) {
    super(props);
    this.scope = props.scope;
    this.plan = props.plan;
    this.sendAt = props.sendAt;
    this.approvalId = props.approvalId;
    this.botId = props.botId;
  }
}
