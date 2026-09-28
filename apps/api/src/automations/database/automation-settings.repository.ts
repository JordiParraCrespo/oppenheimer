import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { WorkspaceLimits } from '../domain/automation-limits.policy';
import { AutomationSettingsOrmEntity } from './automation-settings.orm-entity';
import type { AutomationSettingsRepositoryPort } from './automation-settings.repository.port';

@Injectable()
export class AutomationSettingsRepository implements AutomationSettingsRepositoryPort {
  constructor(
    @InjectRepository(AutomationSettingsOrmEntity)
    private readonly repository: Repository<AutomationSettingsOrmEntity>,
  ) {}

  async find(organizationId: string): Promise<WorkspaceLimits> {
    const record = await this.repository.findOneBy({ organizationId });
    if (!record) return {};
    return {
      maxRunsPerAutomationHour: record.maxRunsPerAutomationHour,
      maxRunsPerWorkspaceHour: record.maxRunsPerWorkspaceHour,
      liveRunsPerHost: record.liveRunsPerHost,
      overlap: record.overlap === 'queue' || record.overlap === 'skip' ? record.overlap : null,
      staleTtlSeconds: record.staleTtlSeconds,
      missedGraceSeconds: record.missedGraceSeconds,
      maxRunSeconds: record.maxRunSeconds,
    };
  }

  async upsert(organizationId: string, limits: WorkspaceLimits): Promise<void> {
    await this.repository.upsert({ organizationId, ...limits }, ['organizationId']);
  }
}
