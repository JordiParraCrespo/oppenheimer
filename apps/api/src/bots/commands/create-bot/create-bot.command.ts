import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { BotPermission, CreateBotDto } from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import type { AccessScope } from '../../../authz/domain/access-scope.types';

/**
 * A new bot. `input` is what the console's form sends; the rest is optional
 * and the console leaves it unset (a bot's `create_bot` tool sets it,
 * `25-bots.md` §4.6).
 */
export class CreateBotCommand extends CommandBase {
  /** The caller, who is recorded as the bot's creator and its documents' first author. */
  readonly scope: AccessScope;
  readonly input: CreateBotDto;
  /** A model id the provider offers; unset or null is the provider's default. */
  readonly model?: string | null;
  /** Kept only when the model offers it. */
  readonly effort?: SessionEffort | null;
  /** Approve for me when unset; never looser than `creatorBotId`'s when that is set. */
  readonly permission?: BotPermission;
  /** Its `SOUL.md`; the template that says its name when unset. */
  readonly soul?: string;
  /** Its `INSTRUCTIONS.md`; empty when unset. */
  readonly instructions?: string;
  /** The bot that is creating it, in the caller's workspace; the new bot is marked as its. */
  readonly creatorBotId?: string;
  /** A creation with a key another one already used answers the bot that one made. */
  readonly idempotencyKey?: string;

  constructor(props: CommandProps<CreateBotCommand>) {
    super(props);
    this.scope = props.scope;
    this.input = props.input;
    this.model = props.model;
    this.effort = props.effort;
    this.permission = props.permission;
    this.soul = props.soul;
    this.instructions = props.instructions;
    this.creatorBotId = props.creatorBotId;
    this.idempotencyKey = props.idempotencyKey;
  }
}
