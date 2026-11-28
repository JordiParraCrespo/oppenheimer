import type { ModelProviderCredentialEntity } from './model-provider-credential.entity';

type OrderedKey = Pick<ModelProviderCredentialEntity, 'position' | 'createdAt' | 'id' | 'spentAt'>;

/** A provider's keys in the order the workspace set: by position, the older row first on a tie. */
export function keysInStoredOrder<Key extends OrderedKey>(keys: readonly Key[]): Key[] {
  return [...keys].sort(
    (a, b) =>
      a.position - b.position ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
}

/**
 * The order a call tries a provider's keys in: the ones not known to be spent,
 * in the order the workspace set; then the spent ones, the one spent longest
 * ago first, since it is the likeliest to have been topped up. A key topped
 * up while a later one still has credit waits until that one runs out too.
 */
export function keysInTurnOrder<Key extends OrderedKey>(keys: readonly Key[]): Key[] {
  const stored = keysInStoredOrder(keys);
  const fresh = stored.filter((key) => key.spentAt === null);
  const spent = stored
    .filter((key): key is Key & { spentAt: Date } => key.spentAt !== null)
    .sort((a, b) => a.spentAt.getTime() - b.spentAt.getTime());
  return [...fresh, ...spent];
}
