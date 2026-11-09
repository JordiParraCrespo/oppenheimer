import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

export class UpdateTelegramAccountCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly accountId: string;
  /** The caller's Oppenheimer bot that answers them here; null for none. */
  readonly answeringBotId: string | null;

  constructor(props: CommandProps<UpdateTelegramAccountCommand>) {
    super(props);
    this.scope = props.scope;
    this.accountId = props.accountId;
    this.answeringBotId = props.answeringBotId;
  }
}
