import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTOMATION_SETTINGS_REPOSITORY } from '../automations.di-tokens';
import type { AutomationSettingsRepositoryPort } from '../database/automation-settings.repository.port';
import {
  type AutomationLimits,
  type AutomationOverrides,
  DEFAULT_PLATFORM_LIMITS,
  type PlatformLimits,
  resolveAutomationLimits,
  type WorkspaceLimits,
} from '../domain/automation-limits.policy';

const DEFAULT_SCHEDULER_BATCH = 200;
const NO_OVERRIDES: AutomationOverrides = { maxRunsPerHour: null, overlap: null };

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
    automation: AutomationOverrides = NO_OVERRIDES,
  ): Promise<AutomationLimits> {
    return this.resolveWith(await this.workspace(organizationId), automation);
  }

  /** The workspace's saved overrides, read once for a caller that weighs many automations. */
  workspace(organizationId: string): Promise<WorkspaceLimits> {
    return this.settings.find(organizationId);
  }

  /** {@link resolve} over overrides the caller already read: pure, no I/O. */
  resolveWith(
    workspace: WorkspaceLimits,
    automation: AutomationOverrides = NO_OVERRIDES,
  ): AutomationLimits {
    return resolveAutomationLimits(this.platform, workspace, automation);
  }

  /** The platform's run-limit ceiling: no workspace lets a run live longer than this. */
  get maxRunCeilingMs(): number {
    return this.platform.ceilings.maxRunSeconds * 1000;
  }

  get schedulerBatch(): number {
    return this.config.get<number>('automations.schedulerBatch') ?? DEFAULT_SCHEDULER_BATCH;
  }

  private get platform(): PlatformLimits {
    const ceiling = (key: string, fallback: number) =>
      this.config.get<number>(`automations.${key}`) ?? fallback;
    const { ceilings } = DEFAULT_PLATFORM_LIMITS;
    const { defaults } = DEFAULT_PLATFORM_LIMITS;
    return {
      defaults: {
        ...defaults,
        diskFloorBytes:
          this.config.get<number>('automations.diskFloorBytes') ?? defaults.diskFloorBytes,
      },
      ceilings: {
        maxRunsPerAutomationHour: ceiling(
          'maxRunsPerAutomationHour',
          ceilings.maxRunsPerAutomationHour,
        ),
        maxRunsPerWorkspaceHour: ceiling(
          'maxRunsPerWorkspaceHour',
          ceilings.maxRunsPerWorkspaceHour,
        ),
        liveRunsPerHost: ceiling('liveRunsPerHost', ceilings.liveRunsPerHost),
        staleTtlSeconds: ceiling('staleTtlSeconds', ceilings.staleTtlSeconds),
        maxRunSeconds: ceiling('maxRunSeconds', ceilings.maxRunSeconds),
      },
    };
  }
}
