import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PermissionDefinition } from '@oppenheimer/shared';

export class RoleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ description: 'System roles cannot be deleted or renamed.' })
  isSystem!: boolean;

  @ApiPropertyOptional({
    description: 'Owning organization, or null for a global role template shared by every tenant.',
    nullable: true,
    type: String,
  })
  organizationId!: string | null;

  @ApiProperty({
    description: 'CASL permission rules granted by this role.',
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  permissions!: PermissionDefinition[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class RolePaginationMetaDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PaginatedRolesResponseDto {
  @ApiProperty({ type: [RoleResponseDto] })
  data!: RoleResponseDto[];

  @ApiProperty({ type: RolePaginationMetaDto })
  meta!: RolePaginationMetaDto;
}
