import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { BotPromptHost } from '../domain/bot-turn-context.policy';

/** A host as a turn's prompt names it. */
export interface OwnerHost extends BotPromptHost {
  id: string;
}

/**
 * The hosts a bot's owner can reach, in the shape a turn's prompt takes
 * (`25-bots.md` §2). A refusal the hosts module raises comes through as
 * its `AppError`; anything else is a fault.
 */
export interface OwnerHostsPort {
  hostsOf(owner: AccessScope): Promise<OwnerHost[]>;
}
