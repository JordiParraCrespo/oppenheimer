import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { MailPlan } from '@oppenheimer/shared';
import type { MailLocalFiles } from '../../domain/mail-send.policy';

/** Replaces a draft in the caller's Gmail with a newly planned message. */
export class UpdateMailDraftCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly draftId: string;
  readonly plan: MailPlan;
  /** The bytes of the plan's files held outside Gmail (images from the bot's chat). */
  readonly localFiles: MailLocalFiles;

  constructor(props: CommandProps<UpdateMailDraftCommand>) {
    super(props);
    this.scope = props.scope;
    this.draftId = props.draftId;
    this.plan = props.plan;
    this.localFiles = props.localFiles;
  }
}
