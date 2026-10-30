import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type {
  CiFindingAction,
  CiFindingConfidence,
  CiFindingFlake,
  CiFindingRelation,
} from '@oppenheimer/shared';
import { CiFindingOrmEntity } from './database/ci-finding.orm-entity';
import { CiFindingEntity } from './domain/ci-finding.entity';
import { CiFindingResponseDto } from './dtos/ci-finding.response.dto';

@Injectable()
export class CiFindingMapper
  implements Mapper<CiFindingEntity, CiFindingOrmEntity, CiFindingResponseDto>
{
  toPersistence(entity: CiFindingEntity): CiFindingOrmEntity {
    const record = new CiFindingOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.githubRepoId = String(entity.githubRepoId);
    record.number = entity.number;
    record.headSha = entity.headSha;
    record.check = entity.check;
    record.rootCause = entity.rootCause;
    record.relation = entity.relation;
    record.flake = entity.flake;
    record.action = entity.action;
    record.next = entity.next;
    record.confidence = entity.confidence;
    record.evidence = [...entity.evidence];
    record.recordedByUserId = entity.recordedByUserId;
    record.recordedByBotId = entity.recordedByBotId;
    return record;
  }

  toDomain(record: CiFindingOrmEntity): CiFindingEntity {
    return CiFindingEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        githubRepoId: Number(record.githubRepoId),
        number: record.number,
        headSha: record.headSha,
        check: record.check,
        rootCause: record.rootCause,
        relation: record.relation as CiFindingRelation,
        flake: record.flake as CiFindingFlake,
        action: record.action as CiFindingAction,
        next: record.next,
        confidence: record.confidence as CiFindingConfidence,
        evidence: Array.isArray(record.evidence)
          ? record.evidence.filter((item): item is string => typeof item === 'string')
          : [],
        recordedByUserId: record.recordedByUserId,
        recordedByBotId: record.recordedByBotId,
      },
    });
  }

  toResponse(entity: CiFindingEntity): CiFindingResponseDto {
    const dto = new CiFindingResponseDto();
    dto.id = entity.id;
    dto.check = entity.check;
    dto.headSha = entity.headSha;
    dto.rootCause = entity.rootCause;
    dto.relation = entity.relation;
    dto.flake = entity.flake;
    dto.action = entity.action;
    dto.next = entity.next;
    dto.confidence = entity.confidence;
    dto.evidence = [...entity.evidence];
    dto.recordedByBotId = entity.recordedByBotId;
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
