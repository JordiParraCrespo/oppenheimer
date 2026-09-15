import { ApiProperty } from '@nestjs/swagger';
import { SCOPES, type Scope } from '@oppenheimer/shared';

export class ApiTokenResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    description: 'Non-secret display prefix. The secret itself is shown only once, at creation.',
    example: 'oppenheimer_pat_a1b2c3',
  })
  prefix!: string;

  @ApiProperty({
    description: 'Granted permissions.',
    enum: [...SCOPES],
    isArray: true,
    example: ['users:read', 'roles:write'],
  })
  scopes!: Scope[];

  @ApiProperty({
    description:
      'Organizations this token is restricted to. Null means it follows the owner’s memberships.',
    type: [String],
    nullable: true,
  })
  organizationIds!: string[] | null;

  @ApiProperty({
    description: 'Source addresses or CIDR blocks the token may be used from.',
    type: [String],
    nullable: true,
  })
  ipAllowlist!: string[] | null;

  @ApiProperty({ nullable: true, type: Date })
  expiresAt!: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  lastUsedAt!: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  revokedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

/**
 * Returned only by `POST /v1/tokens`. This is the single moment the secret
 * exists outside the caller's hands — it is not recoverable afterwards.
 */
export class CreatedApiTokenResponseDto extends ApiTokenResponseDto {
  @ApiProperty({
    description: 'The token secret. Shown once — store it now, it cannot be retrieved again.',
    example: 'oppenheimer_pat_x7Yq…',
  })
  token!: string;
}
