import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class CancelBotTurnCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly turnId: string;

  constructor(props: CommandProps<CancelBotTurnCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.turnId = props.turnId;
  }
}
