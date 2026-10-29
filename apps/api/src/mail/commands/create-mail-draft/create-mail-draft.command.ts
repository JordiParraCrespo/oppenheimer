import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { MailPlan } from '@oppenheimer/shared';

/** Saves a planned message as a draft in the caller's Gmail. Nothing is sent. */
export class CreateMailDraftCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly plan: MailPlan;

  constructor(props: CommandProps<CreateMailDraftCommand>) {
    super(props);
    this.scope = props.scope;
    this.plan = props.plan;
  }
}
