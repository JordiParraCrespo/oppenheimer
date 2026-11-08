import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/** Settings → Memory's "Undo": the facts the latest dream replaced come back. */
export class UndoBotMemoryDreamCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;

  constructor(props: CommandProps<UndoBotMemoryDreamCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
  }
}
