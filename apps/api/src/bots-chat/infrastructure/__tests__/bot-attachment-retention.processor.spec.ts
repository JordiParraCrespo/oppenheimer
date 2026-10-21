import { randomUUID } from 'node:crypto';
import type { Queue } from 'bullmq';
import { configDefaults, configStub } from '../../../config/__tests__/config-stub';
import type { BotAttachmentRepositoryPort } from '../../database/bot-attachment.repository.port';
import { BotAttachmentEntity } from '../../domain/bot-attachment.entity';
import type { BotAttachmentFilesPort } from '../bot-attachment-files.port';
import {
  BotAttachmentRetentionProcessor,
  UNSENT_ATTACHMENT_TTL_MS,
} from '../bot-attachment-retention.processor';

/**
 * The daily sweep of chat images no message carries: a day old at least, the
 * file deleted before the row, and a row whose file could not be deleted kept
 * for the next night, so no file is ever left without a row to find it by.
 */
const { retention } = configDefaults();

function image() {
  return BotAttachmentEntity.upload(
    {
      organizationId: randomUUID(),
      botId: randomUUID(),
      uploadedByUserId: randomUUID(),
      mimeType: 'image/png',
      sizeBytes: 10,
      name: 'shot.png',
    },
    'png',
  );
}

function setup(batches: BotAttachmentEntity[][]) {
  const attachments = {
    findUnclaimedBefore: vi.fn(async (_cutoff: Date, _limit: number) => batches.shift() ?? []),
    deleteUnclaimed: vi.fn(async (ids: readonly string[]) => ids.length),
  } satisfies Partial<BotAttachmentRepositoryPort>;
  const files = {
    store: vi.fn(),
    read: vi.fn(),
    remove: vi.fn(async (_key: string) => undefined),
  } satisfies BotAttachmentFilesPort;
  const queue = { upsertJobScheduler: vi.fn(async () => undefined) } as unknown as Queue;
  const subject = new BotAttachmentRetentionProcessor(
    attachments as unknown as BotAttachmentRepositoryPort,
    files,
    queue,
    configStub(),
  );
  return { subject, attachments, files, queue };
}

describe('BotAttachmentRetentionProcessor', () => {
  it('deletes each unsent image’s file, then its row, a day after upload', async () => {
    const [first, second] = [image(), image()];
    const { subject, attachments, files } = setup([[first, second]]);
    const before = Date.now();

    await expect(subject.process()).resolves.toEqual({ attachments: 2 });

    const [cutoff, limit] = attachments.findUnclaimedBefore.mock.calls[0];
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(UNSENT_ATTACHMENT_TTL_MS);
    expect(before - cutoff.getTime()).toBeLessThan(UNSENT_ATTACHMENT_TTL_MS + 1_000);
    expect(limit).toBe(retention.batchSize);
    expect(files.remove.mock.calls.map(([key]) => key)).toEqual([
      first.storageKey,
      second.storageKey,
    ]);
    expect(attachments.deleteUnclaimed).toHaveBeenCalledWith([first.id, second.id]);
  });

  it('keeps the row of a file storage would not delete, for the next night', async () => {
    const [kept, gone] = [image(), image()];
    const { subject, attachments, files } = setup([[kept, gone]]);
    files.remove.mockRejectedValueOnce(new Error('AccessDenied'));

    await expect(subject.process()).resolves.toEqual({ attachments: 1 });
    expect(attachments.deleteUnclaimed).toHaveBeenCalledWith([gone.id]);
  });

  it('schedules itself once, by id, so every replica upserts the same entry', async () => {
    const { subject, queue } = setup([]);
    await subject.onApplicationBootstrap();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'bot-attachment-retention-daily',
      { pattern: '29 5 * * *', tz: 'UTC' },
      { name: 'purge' },
    );
  });
});
