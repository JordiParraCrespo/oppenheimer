import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { workspaceLimitsOf } from '../automation.mapper';
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
    return workspaceLimitsOf(await this.repository.findOneBy({ organizationId }));
  }

  async upsert(organizationId: string, limits: WorkspaceLimits): Promise<void> {
    await this.repository.upsert({ organizationId, ...limits }, ['organizationId']);
  }
}
