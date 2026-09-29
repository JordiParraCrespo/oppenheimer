import { describe, expect, it, vi } from 'vitest';
import { purgeInBatches } from '../purge-in-batches';

describe('purgeInBatches', () => {
  it('stops on the first short batch, having asked for batchSize each time', async () => {
    const batches = [10, 10, 4, 10];
    const deleteBatch = vi.fn(async () => batches.shift() ?? 0);

    await expect(purgeInBatches(deleteBatch, { batchSize: 10, maxBatches: 50 })).resolves.toBe(24);
    expect(deleteBatch).toHaveBeenCalledTimes(3);
    expect(deleteBatch).toHaveBeenCalledWith(10);
  });

  it('stops at maxBatches even while every batch comes back full', async () => {
    const deleteBatch = vi.fn(async (limit: number) => limit);

    await expect(purgeInBatches(deleteBatch, { batchSize: 10, maxBatches: 3 })).resolves.toBe(30);
    expect(deleteBatch).toHaveBeenCalledTimes(3);
  });
});
