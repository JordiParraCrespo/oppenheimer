import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagRepositoryPort } from '../../../database/feature-flag.repository.port';
import type { FlagSegmentRepositoryPort } from '../../../database/flag-segment.repository.port';
import { FeatureFlagEntity } from '../../../domain/feature-flag.entity';
import { FeatureFlagErrors } from '../../../domain/feature-flags.errors';
import { FlagSegmentEntity } from '../../../domain/flag-segment.entity';
import { UpdateFeatureFlagCommand } from '../update-feature-flag.command';
import { UpdateFeatureFlagCommandHandler } from '../update-feature-flag.command-handler';

describe('UpdateFeatureFlagCommandHandler', () => {
  let flags: Pick<FeatureFlagRepositoryPort, 'findOneByKey' | 'save'>;
  let segments: Pick<FlagSegmentRepositoryPort, 'findAll'>;
  let handler: UpdateFeatureFlagCommandHandler;

  beforeEach(() => {
    flags = {
      findOneByKey: vi.fn().mockResolvedValue(None),
      save: vi.fn().mockImplementation(async (flag) => flag),
    };
    segments = {
      findAll: vi.fn().mockResolvedValue([
        FlagSegmentEntity.createNew(
          {
            key: 'staff',
            name: 'Staff',
            conditions: [{ attribute: 'email', operator: 'ends_with', values: ['@acme.com'] }],
          },
          { actorId: null },
        ),
      ]),
    };
    handler = new UpdateFeatureFlagCommandHandler(
      flags as FeatureFlagRepositoryPort,
      segments as FlagSegmentRepositoryPort,
    );
  });

  const command = (overrides: Partial<UpdateFeatureFlagCommand> = {}) =>
    new UpdateFeatureFlagCommand({
      key: 'api_token_creation',
      enabled: true,
      rules: [
        {
          id: 'staff-only',
          conditions: [{ attribute: 'segment', operator: 'in', values: ['staff'] }],
          serve: { value: true },
        },
      ],
      fallthrough: { value: false },
      comment: 'staff first',
      actorId: 'admin-1',
      ...overrides,
    });

  it('creates the row on first save and audits the change', async () => {
    await handler.execute(command());

    const saved = vi.mocked(flags.save).mock.calls[0]?.[0] as FeatureFlagEntity;
    expect(saved.key).toBe('api_token_creation');
    expect(saved.rules).toHaveLength(1);
    expect(saved.domainEvents).toHaveLength(1);
  });

  it('updates the existing row, keeping its salt', async () => {
    const existing = FeatureFlagEntity.createFor('api_token_creation', true);
    vi.mocked(flags.findOneByKey).mockResolvedValue(Some(existing));

    await handler.execute(command());

    const saved = vi.mocked(flags.save).mock.calls[0]?.[0] as FeatureFlagEntity;
    expect(saved.id).toBe(existing.id);
    expect(saved.salt).toBe(existing.salt);
  });

  it('refuses a key the catalog does not declare', async () => {
    await expect(handler.execute(command({ key: 'made_up' }))).rejects.toMatchObject({
      code: FeatureFlagErrors.UNKNOWN_FLAG.code,
    });
    expect(flags.save).not.toHaveBeenCalled();
  });

  it('refuses targeting that makes no sense for the flag, listing why', async () => {
    await expect(
      handler.execute(
        command({
          rules: [
            {
              id: 'ghost',
              conditions: [{ attribute: 'segment', operator: 'in', values: ['ghost'] }],
              serve: { value: 'yes' },
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({
      code: FeatureFlagErrors.INVALID_TARGETING.code,
      extensions: { problems: expect.arrayContaining([expect.stringMatching(/ghost/)]) },
    });
    expect(flags.save).not.toHaveBeenCalled();
  });
});
