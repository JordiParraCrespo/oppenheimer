import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { AutomationLimitsResolver } from '../application/automation-limits.resolver';
import type { AutomationSettingsRepositoryPort } from '../database/automation-settings.repository.port';
import type { WorkspaceLimits } from '../domain/automation-limits.policy';

const saved: WorkspaceLimits = {
  maxRunsPerAutomationHour: 4,
  maxRunsPerWorkspaceHour: 30,
  overlap: 'queue',
  maxRunSeconds: 99_999,
};

function resolver(config: Record<string, number> = {}) {
  const settings: AutomationSettingsRepositoryPort = {
    find: vi.fn(async () => saved),
    upsert: vi.fn(),
  };
  const configService = {
    get: (key: string) => config[key.replace('automations.', '')],
  } as unknown as ConfigService;
  return { limits: new AutomationLimitsResolver(settings, configService), settings };
}

describe('AutomationLimitsResolver', () => {
  it('resolves the same limits from overrides already read as from the store', async () => {
    const { limits } = resolver();
    const automation = { maxRunsPerHour: 2, overlap: null };
    expect(limits.resolveWith(saved, automation)).toEqual(
      await limits.resolve('org-1', automation),
    );
    expect(limits.resolveWith(saved)).toEqual(await limits.resolve('org-1'));
  });

  it("reads the workspace's overrides from the store once per call to workspace()", async () => {
    const { limits, settings } = resolver();
    expect(await limits.workspace('org-1')).toBe(saved);
    expect(settings.find).toHaveBeenCalledWith('org-1');
  });

  it("names the platform's run ceiling, configured or default", () => {
    expect(resolver().limits.maxRunCeilingMs).toBe(6 * 60 * 60 * 1000);
    expect(resolver({ maxRunSeconds: 120 }).limits.maxRunCeilingMs).toBe(120_000);
  });
});
