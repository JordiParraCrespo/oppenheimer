import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One action a resource supports. */
export class ResourceActionDto {
  @ApiProperty({ example: 'read' })
  name!: string;

  @ApiPropertyOptional({ example: 'View leads' })
  label?: string;

  @ApiPropertyOptional({
    description: 'Flagged in the role builder. Not treated differently at request time.',
    example: false,
  })
  sensitive?: boolean;
}

/** A resource a role can be granted permissions over. */
export class AuthzResourceDto {
  @ApiProperty({ example: 'Lead' })
  subject!: string;

  @ApiProperty({ example: 'Leads' })
  label!: string;

  @ApiProperty({ example: 'crm' })
  group!: string;

  @ApiProperty({ type: [ResourceActionDto] })
  actions!: ResourceActionDto[];

  @ApiPropertyOptional({
    description: 'Attributes that may be granted or denied individually.',
    example: ['value', 'notes'],
  })
  fields?: string[];

  @ApiProperty({
    description: 'Scope dimensions this resource can be narrowed by.',
    example: ['organization', 'team'],
  })
  scopes!: string[];

  @ApiPropertyOptional({
    description: 'Credential-scope group, when the resource is reachable by API tokens.',
    example: 'leads',
  })
  credentialScope?: string;
}

/** Resources grouped for display. */
export class AuthzResourceGroupDto {
  @ApiProperty({ example: 'crm' })
  group!: string;

  @ApiProperty({ type: [AuthzResourceDto] })
  resources!: AuthzResourceDto[];
}

/** A single `(action, subject)` pair. */
export class AuthzRuleDto {
  @ApiProperty({ example: 'read' })
  action!: string;

  @ApiProperty({ example: 'Lead' })
  subject!: string;
}

export class AuthzCatalogResponseDto {
  @ApiProperty({ type: [AuthzResourceGroupDto] })
  groups!: AuthzResourceGroupDto[];

  @ApiProperty({
    description:
      'Rules the caller may put on a role. Anything outside this list is rejected, so the role builder can disable it up front.',
    type: [AuthzRuleDto],
  })
  grantable!: AuthzRuleDto[];
}
