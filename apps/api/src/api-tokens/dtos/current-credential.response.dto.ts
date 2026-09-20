import { ApiProperty } from '@nestjs/swagger';
import { SCOPES, type Scope } from '@oppenheimer/shared';

export class CurrentCredentialResponseDto {
  /**
   * Typed `string` because credential kinds are contributed to the auth kernel
   * by the modules that own them: the enum below is the set this API registers
   * today, and a module adding a kind adds itself to it.
   */
  @ApiProperty({
    description: 'How the caller authenticated.',
    enum: ['session', 'api-token', 'oauth'],
  })
  kind!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({
    description:
      'Scopes the credential carries. Null for a browser session, which is not scope-restricted.',
    enum: [...SCOPES],
    isArray: true,
    nullable: true,
  })
  grantedScopes!: Scope[] | null;

  @ApiProperty({
    description:
      'What the credential can actually do: its scopes intersected with the owner’s current roles.',
    enum: [...SCOPES],
    isArray: true,
  })
  effectiveScopes!: Scope[];

  @ApiProperty({
    description: 'Organizations the credential is restricted to, or null when unrestricted.',
    type: [String],
    nullable: true,
  })
  organizationIds!: string[] | null;

  @ApiProperty({ nullable: true, type: Date })
  expiresAt!: Date | null;
}
