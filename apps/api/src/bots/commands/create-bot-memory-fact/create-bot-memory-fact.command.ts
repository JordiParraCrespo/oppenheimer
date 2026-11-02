import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotMemoryScope, BotMemoryTier } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class CreateBotMemoryFactCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly content: string;
  readonly tier?: BotMemoryTier;
  /** Who it is for; called `memoryScope` beside the caller's access `scope`. */
  readonly memoryScope?: BotMemoryScope;

  constructor(props: CommandProps<CreateBotMemoryFactCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.content = props.content;
    this.tier = props.tier;
    this.memoryScope = props.memoryScope;
  }
}
