import { Injectable } from '@nestjs/common';
import {
  canGrant,
  type ResourceDefinition,
  type ResourceRegistry,
} from '@oppenheimer/backend-authz';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { AppAbility } from '@oppenheimer/shared';
import { AccessGrantOrmEntity } from './database/access-grant.orm-entity';
import { AccessGrantEntity } from './domain/access-grant.entity';
import { AccessGrantResponseDto } from './dtos/access-grant.response.dto';
import type {
  AuthzCatalogResponseDto,
  AuthzResourceDto,
  AuthzRuleDto,
} from './dtos/authz-catalog.response.dto';

/** Maps the access-grant aggregate between its three shapes. */
@Injectable()
export class AccessGrantMapper
  implements Mapper<AccessGrantEntity, AccessGrantOrmEntity, AccessGrantResponseDto>
{
  toPersistence(entity: AccessGrantEntity): AccessGrantOrmEntity {
    const record = new AccessGrantOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.principalType = entity.principalType;
    record.principalId = entity.principalId;
    record.resourceType = entity.resourceType;
    record.resourceId = entity.resourceId;
    record.grantedBy = entity.grantedBy;
    record.expiresAt = entity.expiresAt;
    return record;
  }

  toDomain(record: AccessGrantOrmEntity): AccessGrantEntity {
    return AccessGrantEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      // The table is append-only, so there is no separate updated timestamp.
      updatedAt: record.createdAt,
      props: {
        organizationId: record.organizationId,
        principalType: record.principalType,
        principalId: record.principalId,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        grantedBy: record.grantedBy,
        expiresAt: record.expiresAt,
      },
    });
  }

  toResponse(entity: AccessGrantEntity): AccessGrantResponseDto {
    const dto = new AccessGrantResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.principalType = entity.principalType;
    dto.principalId = entity.principalId;
    dto.resourceType = entity.resourceType;
    dto.resourceId = entity.resourceId;
    dto.grantedBy = entity.grantedBy;
    dto.expiresAt = entity.expiresAt;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}

/**
 * Registry declarations → the catalog wire shape.
 *
 * Pure and DI-free: the query handler resolves the ability and delegates the
 * shaping here.
 */
export function toResourceDto(resource: ResourceDefinition): AuthzResourceDto {
  return {
    subject: resource.subject,
    label: resource.label,
    group: resource.group,
    actions: resource.actions.map((action) => ({
      name: action.name,
      ...(action.label ? { label: action.label } : {}),
      ...(action.sensitive !== undefined ? { sensitive: action.sensitive } : {}),
    })),
    ...(resource.fields ? { fields: [...resource.fields] } : {}),
    scopes: [...resource.scopes],
    ...(resource.credentialScope ? { credentialScope: resource.credentialScope } : {}),
  };
}

export function toCatalogResponse(
  registry: ResourceRegistry,
  ability: AppAbility,
): AuthzCatalogResponseDto {
  const groups = registry.byGroup().map((group) => ({
    group: group.group,
    resources: group.resources.map(toResourceDto),
  }));

  // The same containment rule the write path enforces, evaluated up front so
  // the role builder can disable what would be rejected rather than surfacing
  // the rejection after the fact.
  const grantable: AuthzRuleDto[] = registry
    .knownRules()
    .filter((rule) => canGrant(ability, [rule]))
    .map((rule) => ({ action: rule.action, subject: rule.subject }));

  return { groups, grantable };
}
