import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTOMATION_SETTINGS_REPOSITORY } from '../automations.di-tokens';
import type { AutomationSettingsRepositoryPort } from '../database/automation-settings.repository.port';
import {
  type AutomationLimits,
  DEFAULT_PLATFORM_LIMITS,
  type PlatformLimits,
  resolveAutomationLimits,
} from '../domain/automation-limits.policy';

/** The effective limits for one automation: platform ∩ workspace ∩ automation. */
@Injectable()
export class AutomationLimitsResolver {
  constructor(
    @Inject(AUTOMATION_SETTINGS_REPOSITORY)
    private readonly settings: AutomationSettingsRepositoryPort,
    private readonly config: ConfigService,
  ) {}

  async resolve(
    organizationId: string,
    automation: { maxRunsPerHour: number | null; overlap: 'skip' | 'queue' | null } = {
      maxRunsPerHour: null,
      overlap: null,
    },
  ): Promise<AutomationLimits> {
    return resolveAutomationLimits(
      this.platform,
      await this.settings.find(organizationId),
      automation,
    );
  }

  get schedulerBatch(): number {
    return this.config.get<number>('automations.schedulerBatch') ?? 200;
  }

  private get platform(): PlatformLimits {
    const ceiling = (key: string, fallback: number) =>
      this.config.get<number>(`automations.${key}`) ?? fallback;
    const { ceilings } = DEFAULT_PLATFORM_LIMITS;
    return {
      defaults: DEFAULT_PLATFORM_LIMITS.defaults,
      ceilings: {
        maxRunsPerAutomationHour: ceiling(
          'maxRunsPerAutomationHour',
          ceilings.maxRunsPerAutomationHour,
        ),
        maxRunsPerWorkspaceHour: ceiling(
          'maxRunsPerWorkspaceHour',
          ceilings.maxRunsPerWorkspaceHour,
        ),
        headlessRunsPerHost: ceiling('headlessRunsPerHost', ceilings.headlessRunsPerHost),
        staleTtlSeconds: ceiling('staleTtlSeconds', ceilings.staleTtlSeconds),
        maxRunSeconds: ceiling('maxRunSeconds', ceilings.maxRunSeconds),
      },
    };
  }
}
