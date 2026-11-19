import type { WhatsappChatGrantEntity } from '@oppenheimer/frontend-consumer';

/** Who an allowed chat says allowed it: a bot by name, a bot since removed, or the reader. */
export type AllowedBy = { kind: 'bot'; name: string } | { kind: 'removedBot' } | { kind: 'you' };

/**
 * Who allowed a chat, from the grant and the reader's bots by id: the bot
 * whose tool did, while it still exists; a removed bot when it does not;
 * the reader when no bot did.
 */
export function allowedByOf(
  grant: Pick<WhatsappChatGrantEntity, 'grantedByBotId'>,
  botNames: ReadonlyMap<string, string>,
): AllowedBy {
  if (!grant.grantedByBotId) return { kind: 'you' };
  const name = botNames.get(grant.grantedByBotId);
  return name ? { kind: 'bot', name } : { kind: 'removedBot' };
}
