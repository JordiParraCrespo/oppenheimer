import type { Scope } from '@oppenheimer/shared';
import type { BotTurnEntity } from './bot-turn.entity';

/**
 * Whether the running turn takes a waiting steer's message (Codex's
 * `turn/steer`): a message of yours sent as a steer to the same bot, still
 * queued, into a turn of yours on the same footing. The same sender and the
 * same credential scopes, because the message then runs with the running
 * turn's tools: a token's steer never reaches through a browser session's
 * turn, nor one person's through another's. A routine's run, a bot's ask
 * and a wake are not yours to steer. A steer the policy refuses waits and
 * runs as the turn it is.
 */
export function takesSteer(running: BotTurnEntity, waiting: BotTurnEntity): boolean {
  return (
    running.status === 'running' &&
    running.lane === 'owner' &&
    waiting.status === 'queued' &&
    waiting.steer &&
    waiting.id !== running.id &&
    waiting.organizationId === running.organizationId &&
    waiting.botId === running.botId &&
    running.requestedByUserId !== null &&
    waiting.requestedByUserId === running.requestedByUserId &&
    sameScopes(running.credentialScopes, waiting.credentialScopes)
  );
}

/** Two credentials' scopes, as sets; null (a browser session) only matches null. */
function sameScopes(a: readonly Scope[] | null, b: readonly Scope[] | null): boolean {
  if (a === null || b === null) return a === b;
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((scope) => right.has(scope));
}
