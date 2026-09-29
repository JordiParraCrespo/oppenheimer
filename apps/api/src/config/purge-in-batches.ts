/**
 * The one batch loop behind every nightly purge: delete up to `batchSize` rows,
 * again, until a statement comes back short (nothing left) or `maxBatches`
 * statements have run (the rest is the next night's). Small statements keep a
 * large purge from holding a long lock. Takes the `retention` section's
 * `batchSize` and `maxBatches`; returns the rows deleted.
 */
export async function purgeInBatches(
  deleteBatch: (limit: number) => Promise<number>,
  { batchSize, maxBatches }: { batchSize: number; maxBatches: number },
): Promise<number> {
  let total = 0;
  for (let i = 0; i < maxBatches; i += 1) {
    const deleted = await deleteBatch(batchSize);
    total += deleted;
    if (deleted < batchSize) break;
  }
  return total;
}
