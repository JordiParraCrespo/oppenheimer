import type { AccessScope } from '@oppenheimer/backend-authz';
import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { Scope, TriggerInputDto } from '@oppenheimer/shared';

/** What a routine save changes; a create needs the name, the prompt and a trigger. */
export interface BotRoutineChanges {
  name?: string;
  prompt?: string;
  /** One or more; any one fires a run. Replaces the set on an update. */
  triggers?: readonly TriggerInputDto[];
  enabled?: boolean;
}

/**
 * A bot saves one of its routines (`26-bot-routines.md` §4, `update_routine`
 * create and update): a new one when `routineId` is absent. The bot was
 * checked by the caller; the routine must be that bot's.
 */
export class SaveBotRoutineCommand extends CommandBase {
  readonly scope: AccessScope;
  readonly botId: string;
  readonly routineId: string | null;
  readonly changes: BotRoutineChanges;
  /** The saving credential's scopes; null for a browser session. Its runs get no more. */
  readonly credentialScopes: readonly Scope[] | null;

  constructor(props: CommandProps<SaveBotRoutineCommand>) {
    super(props);
    this.scope = props.scope;
    this.botId = props.botId;
    this.routineId = props.routineId;
    this.changes = props.changes;
    this.credentialScopes = props.credentialScopes;
  }
}
