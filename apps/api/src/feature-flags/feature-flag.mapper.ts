import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { FlagDefinition, FlagEvaluation } from '@oppenheimer/shared/feature-flags';
import { FeatureFlagOrmEntity } from './database/feature-flag.orm-entity';
import type { FlagChangeRecord } from './database/flag-change.repository.port';
import { FeatureFlagEntity } from './domain/feature-flag.entity';
import {
  FeatureFlagConfigResponseDto,
  FeatureFlagResponseDto,
  FlagEvaluationResponseDto,
} from './dtos/feature-flag.response.dto';
import { FlagChangeResponseDto } from './dtos/flag-change.response.dto';

/**
 * Maps flag targeting between its domain, persistence and response shapes,
 * and joins it to the catalog entry for the control plane's view of a flag.
 */
@Injectable()
export class FeatureFlagMapper
  implements Mapper<FeatureFlagEntity, FeatureFlagOrmEntity, FeatureFlagConfigResponseDto>
{
  toPersistence(entity: FeatureFlagEntity): FeatureFlagOrmEntity {
    const record = new FeatureFlagOrmEntity();
    record.id = entity.id;
    record.key = entity.key;
    record.enabled = entity.enabled;
    record.rules = entity.rules;
    record.fallthrough = entity.fallthrough;
    record.salt = entity.salt;
    record.updatedBy = entity.updatedBy;
    return record;
  }

  toDomain(record: FeatureFlagOrmEntity): FeatureFlagEntity {
    return FeatureFlagEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        key: record.key,
        enabled: record.enabled,
        rules: record.rules ?? [],
        fallthrough: record.fallthrough,
        salt: record.salt,
        updatedBy: record.updatedBy ?? null,
      },
    });
  }

  toResponse(entity: FeatureFlagEntity): FeatureFlagConfigResponseDto {
    const dto = new FeatureFlagConfigResponseDto();
    dto.enabled = entity.enabled;
    dto.rules = entity.rules;
    dto.fallthrough = entity.fallthrough;
    dto.updatedBy = entity.updatedBy;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  /**
   * A catalog flag joined to its targeting. `today` (`YYYY-MM-DD`) decides
   * `expired`; it is a parameter so a test can pin it.
   */
  toFlagResponse(
    key: string,
    definition: FlagDefinition,
    entity: FeatureFlagEntity | undefined,
    today: string = new Date().toISOString().slice(0, 10),
  ): FeatureFlagResponseDto {
    const dto = new FeatureFlagResponseDto();
    dto.key = key;
    dto.description = definition.description;
    dto.kind = definition.kind;
    dto.owner = definition.owner;
    dto.type = definition.type;
    dto.variants = definition.type === 'variant' ? [...definition.variants] : [];
    dto.defaultValue = definition.defaultValue;
    dto.client = definition.client;
    dto.bucketBy = definition.bucketBy ?? 'organization';
    dto.expiresAt = definition.expiresAt ?? null;
    dto.expired =
      definition.kind !== 'ops' &&
      definition.expiresAt !== undefined &&
      definition.expiresAt <= today;
    dto.config = entity ? this.toResponse(entity) : null;
    return dto;
  }

  toEvaluationResponse(evaluation: FlagEvaluation): FlagEvaluationResponseDto {
    const dto = new FlagEvaluationResponseDto();
    dto.key = evaluation.key;
    dto.value = evaluation.value;
    dto.reason = evaluation.reason;
    if (evaluation.ruleId) dto.ruleId = evaluation.ruleId;
    return dto;
  }

  toChangeResponse(change: FlagChangeRecord): FlagChangeResponseDto {
    const dto = new FlagChangeResponseDto();
    dto.id = change.id;
    dto.subjectType = change.subjectType;
    dto.subjectKey = change.subjectKey;
    dto.action = change.action;
    dto.actorId = change.actorId;
    dto.comment = change.comment;
    dto.before = change.before;
    dto.after = change.after;
    dto.createdAt = change.createdAt;
    return dto;
  }
}
