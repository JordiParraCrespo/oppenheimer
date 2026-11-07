import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotAuthor, BotMemoryScope, BotMemoryTier } from '@oppenheimer/shared';

export class CreateBotMemoryFactCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly content: string;
  readonly tier?: BotMemoryTier;
  /** Who it is for; called `memoryScope` beside the caller's access `scope`. */
  readonly memoryScope?: BotMemoryScope;
  /**
   * `bot` when the bot saves it through `remember`, rather than a person in
   * Settings (the default): the bot is its source, and a full memory drops
   * the bot's oldest `log` fact to make room instead of refusing it.
   */
  readonly author?: BotAuthor;

  constructor(props: CommandProps<CreateBotMemoryFactCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.content = props.content;
    this.tier = props.tier;
    this.memoryScope = props.memoryScope;
    this.author = props.author;
  }
}
