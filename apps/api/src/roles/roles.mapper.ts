import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { RoleOrmEntity } from './database/role.orm-entity';
import { RoleEntity } from './domain/role.entity';
import { Permission } from './domain/value-objects/permission.value-object';
import { RoleResponseDto } from './dtos/role.response.dto';

/** Maps the role aggregate between its domain, persistence and response shapes. */
@Injectable()
export class RoleMapper implements Mapper<RoleEntity, RoleOrmEntity, RoleResponseDto> {
  toPersistence(entity: RoleEntity): RoleOrmEntity {
    const record = new RoleOrmEntity();
    record.id = entity.id;
    record.name = entity.name;
    record.description = entity.description;
    record.isSystem = entity.isSystem;
    record.organizationId = entity.organizationId;
    record.permissions = entity.permissions.map((permission) => permission.toDefinition());
    return record;
  }

  toDomain(record: RoleOrmEntity): RoleEntity {
    return RoleEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        name: record.name,
        description: record.description,
        isSystem: record.isSystem,
        organizationId: record.organizationId ?? null,
        permissions: (record.permissions ?? []).map((definition) =>
          Permission.fromDefinition(definition),
        ),
      },
    });
  }

  toResponse(entity: RoleEntity): RoleResponseDto {
    const dto = new RoleResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.isSystem = entity.isSystem;
    dto.organizationId = entity.organizationId;
    dto.permissions = entity.permissions.map((permission) => permission.toDefinition());
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
