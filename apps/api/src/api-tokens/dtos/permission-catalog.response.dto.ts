import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type Actions,
  SCOPE_RESOURCES,
  SCOPES,
  type Scope,
  type ScopeResource,
  type Subjects,
} from '@oppenheimer/shared';

/**
 * A CASL rule backing a permission level. A user may only grant the level if
 * their own ability satisfies at least one of these.
 */
export class ScopePolicyDto {
  @ApiProperty({ example: 'read' })
  action!: Actions;

  @ApiProperty({ example: 'User' })
  subject!: Subjects;
}

/** One access level (Read or Edit) of a permission group. */
export class ScopeLevelDto {
  @ApiProperty({ enum: [...SCOPES], example: 'users:read' })
  scope!: Scope;

  @ApiProperty({ example: 'Read' })
  label!: string;

  @ApiProperty({ example: 'Browse the user directory.' })
  description!: string;

  @ApiProperty({
    description: 'Empty when the level governs the caller’s own account only.',
    type: [ScopePolicyDto],
  })
  policies!: readonly ScopePolicyDto[];
}

/** The two levels every permission group offers. Edit implies Read. */
export class ScopeLevelsDto {
  @ApiProperty({ type: ScopeLevelDto })
  read!: ScopeLevelDto;

  @ApiProperty({ type: ScopeLevelDto })
  write!: ScopeLevelDto;
}

/** A resource a credential can be scoped to, with its Read and Edit levels. */
export class PermissionGroupDto {
  @ApiProperty({ enum: [...SCOPE_RESOURCES], example: 'users' })
  resource!: ScopeResource;

  @ApiProperty({ example: 'Users' })
  label!: string;

  @ApiProperty({ example: 'The user directory.' })
  description!: string;

  @ApiPropertyOptional({
    description:
      'Grants account-takeover-adjacent powers. Consent and token screens call these out; enforcement treats them like any other group.',
  })
  sensitive?: boolean;

  @ApiProperty({ type: ScopeLevelsDto })
  levels!: ScopeLevelsDto;
}

/**
 * The permission catalog plus the subset the caller may actually grant. The
 * catalog itself is static and also available from `@oppenheimer/shared`; what only
 * the server can answer is `grantable`, which depends on the caller's roles.
 */
export class PermissionCatalogResponseDto {
  @ApiProperty({
    description:
      'Every permission group, each with a Read and an Edit level. Render these as the permission picker.',
    type: [PermissionGroupDto],
  })
  groups!: readonly PermissionGroupDto[];

  @ApiProperty({
    description:
      'Scopes the caller may put on a token. Anything outside this list is refused at creation.',
    enum: [...SCOPES],
    isArray: true,
    example: ['profile:read', 'users:read'],
  })
  grantable!: Scope[];
}
