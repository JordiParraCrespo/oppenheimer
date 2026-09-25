import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagRepositoryPort } from '../../../database/feature-flag.repository.port';
import type { FlagSegmentRepositoryPort } from '../../../database/flag-segment.repository.port';
import { FeatureFlagEntity } from '../../../domain/feature-flag.entity';
import { FeatureFlagErrors } from '../../../domain/feature-flags.errors';
import { FlagSegmentEntity } from '../../../domain/flag-segment.entity';
import { DeleteFlagSegmentCommand } from '../delete-flag-segment.command';
import { DeleteFlagSegmentCommandHandler } from '../delete-flag-segment.command-handler';

function staff(): FlagSegmentEntity {
  return FlagSegmentEntity.createNew(
    {
      key: 'staff',
      name: 'Staff',
      conditions: [{ attribute: 'email', operator: 'ends_with', values: ['@acme.com'] }],
    },
    { actorId: null },
  );
}

describe('DeleteFlagSegmentCommandHandler', () => {
  let segments: Pick<FlagSegmentRepositoryPort, 'findOneByKey' | 'delete'>;
  let flags: Pick<FeatureFlagRepositoryPort, 'findAll'>;
  let handler: DeleteFlagSegmentCommandHandler;

  beforeEach(() => {
    segments = {
      findOneByKey: vi.fn().mockResolvedValue(Some(staff())),
      delete: vi.fn().mockResolvedValue(true),
    };
    flags = { findAll: vi.fn().mockResolvedValue([]) };
    handler = new DeleteFlagSegmentCommandHandler(
      segments as FlagSegmentRepositoryPort,
      flags as FeatureFlagRepositoryPort,
    );
  });

  it('deletes an unused segment and audits it', async () => {
    await handler.execute(new DeleteFlagSegmentCommand({ key: 'staff', actorId: 'admin-1' }));

    const deleted = vi.mocked(segments.delete).mock.calls[0]?.[0] as FlagSegmentEntity;
    expect(deleted.domainEvents.at(-1)).toMatchObject({ action: 'segment_deleted' });
  });

  it('refuses while a flag still targets it, naming the flag', async () => {
    const flag = FeatureFlagEntity.createFor('api_token_creation', true);
    flag.replaceTargeting(
      {
        enabled: true,
        rules: [
          {
            id: 'staff',
            conditions: [{ attribute: 'segment', operator: 'in', values: ['staff'] }],
            serve: { value: false },
          },
        ],
        fallthrough: { value: true },
      },
      { actorId: null },
    );
    vi.mocked(flags.findAll).mockResolvedValue([flag]);

    await expect(
      handler.execute(new DeleteFlagSegmentCommand({ key: 'staff', actorId: 'admin-1' })),
    ).rejects.toMatchObject({
      code: FeatureFlagErrors.SEGMENT_IN_USE.code,
      extensions: { usedBy: ['api_token_creation'] },
    });
    expect(segments.delete).not.toHaveBeenCalled();
  });

  it('reports a missing segment as not found', async () => {
    vi.mocked(segments.findOneByKey).mockResolvedValue(None);
    await expect(
      handler.execute(new DeleteFlagSegmentCommand({ key: 'ghost', actorId: null })),
    ).rejects.toMatchObject({ code: FeatureFlagErrors.SEGMENT_NOT_FOUND.code });
  });
});
