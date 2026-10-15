import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotPermission, CreateBotDto } from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';

/**
 * What a bot creating a bot (`create_bot`, `25-bots.md` §4.6) sets beyond
 * what the console's form does: the engine, the level, both documents, the
 * creator, and the key that makes the creation happen once.
 */
export interface CreateBotByBot {
  /** The creating bot, in the caller's workspace. The new bot is marked as its. */
  creatorBotId: string;
  /** A retried creation with the same key answers the bot the first one made. */
  idempotencyKey: string;
  /** A model id the provider offers; null is the provider's default. */
  model: string | null;
  effort: SessionEffort | null;
  /** No looser than the creator's own (`permissionForBotMadeBy`). */
  permission: BotPermission;
  /** Its `SOUL.md`; the template that says its name when absent. */
  soul?: string;
  /** Its `INSTRUCTIONS.md`; empty when absent. */
  instructions?: string;
}

export class CreateBotCommand extends CommandBase {
  /** The caller, who is recorded as the bot's creator and its documents' first author. */
  readonly scope: AccessScope;
  readonly input: CreateBotDto;
  /** Set when a bot creates it through its tools; the console's creations carry none. */
  readonly byBot?: CreateBotByBot;

  constructor(props: CommandProps<CreateBotCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
    this.byBot = props.byBot;
  }
}
