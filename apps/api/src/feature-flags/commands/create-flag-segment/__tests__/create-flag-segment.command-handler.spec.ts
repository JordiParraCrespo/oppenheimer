import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlagSegmentRepositoryPort } from '../../../database/flag-segment.repository.port';
import { FeatureFlagErrors } from '../../../domain/feature-flags.errors';
import { FlagSegmentEntity } from '../../../domain/flag-segment.entity';
import { CreateFlagSegmentCommand } from '../create-flag-segment.command';
import { CreateFlagSegmentCommandHandler } from '../create-flag-segment.command-handler';

describe('CreateFlagSegmentCommandHandler', () => {
  let segments: Pick<FlagSegmentRepositoryPort, 'findOneByKey' | 'insert'>;
  let handler: CreateFlagSegmentCommandHandler;

  const command = (conditions: CreateFlagSegmentCommand['conditions']) =>
    new CreateFlagSegmentCommand({ key: 'beta', name: 'Beta', conditions, actorId: 'admin-1' });

  beforeEach(() => {
    segments = {
      findOneByKey: vi.fn().mockResolvedValue(None),
      insert: vi.fn().mockResolvedValue(undefined),
    };
    handler = new CreateFlagSegmentCommandHandler(segments as FlagSegmentRepositoryPort);
  });

  it('creates it and audits the creation', async () => {
    await handler.execute(
      command([{ attribute: 'organizationId', operator: 'in', values: ['org-1', 'org-2'] }]),
    );

    const inserted = vi.mocked(segments.insert).mock.calls[0]?.[0] as FlagSegmentEntity;
    expect(inserted.key).toBe('beta');
    expect(inserted.domainEvents).toHaveLength(1);
  });

  it('refuses a taken key', async () => {
    vi.mocked(segments.findOneByKey).mockResolvedValue(
      Some(
        FlagSegmentEntity.createNew(
          { key: 'beta', name: 'Beta', conditions: [] },
          { actorId: null },
        ),
      ),
    );
    await expect(
      handler.execute(command([{ attribute: 'userId', operator: 'in', values: ['u1'] }])),
    ).rejects.toMatchObject({ code: FeatureFlagErrors.SEGMENT_KEY_TAKEN.code });
  });

  it('refuses a version comparison on anything but appVersion', async () => {
    await expect(
      handler.execute(command([{ attribute: 'email', operator: 'semver_gte', values: ['1.0.0'] }])),
    ).rejects.toMatchObject({ code: FeatureFlagErrors.INVALID_SEGMENT.code });
    expect(segments.insert).not.toHaveBeenCalled();
  });
});
