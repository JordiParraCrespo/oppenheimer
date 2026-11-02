import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotMemoryScope, BotMemoryTier } from '@oppenheimer/shared';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

export class UpdateBotMemoryFactCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly factId: string;
  /** New words, a new tier, a new scope: whichever are given change. */
  readonly change: { content?: string; tier?: BotMemoryTier; scope?: BotMemoryScope };

  constructor(props: CommandProps<UpdateBotMemoryFactCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.factId = props.factId;
    this.change = props.change;
  }
}
