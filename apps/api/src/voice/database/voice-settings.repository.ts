import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { VoiceSettings } from '@oppenheimer/shared';
import { Repository } from 'typeorm';
import { VoiceSettingsMapper } from '../voice-settings.mapper';
import { VoiceSettingsOrmEntity } from './voice-settings.orm-entity';
import type { VoiceSettingsRepositoryPort } from './voice-settings.repository.port';

@Injectable()
export class VoiceSettingsRepository implements VoiceSettingsRepositoryPort {
  constructor(
    @InjectRepository(VoiceSettingsOrmEntity)
    private readonly repository: Repository<VoiceSettingsOrmEntity>,
  ) {}

  async find(organizationId: string): Promise<VoiceSettings> {
    return VoiceSettingsMapper.toSettings(await this.repository.findOneBy({ organizationId }));
  }

  async put(organizationId: string, settings: VoiceSettings): Promise<void> {
    await this.repository.upsert({ organizationId, ...settings }, ['organizationId']);
  }
}
