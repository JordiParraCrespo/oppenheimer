import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { MailPlan } from '@oppenheimer/shared';

/** Replaces a draft in the caller's Gmail with a newly planned message. */
export class UpdateMailDraftCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly draftId: string;
  readonly plan: MailPlan;

  constructor(props: CommandProps<UpdateMailDraftCommand>) {
    super(props);
    this.scope = props.scope;
    this.draftId = props.draftId;
    this.plan = props.plan;
  }
}
