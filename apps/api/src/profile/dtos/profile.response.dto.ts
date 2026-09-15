import { ApiProperty } from '@nestjs/swagger';

/**
 * The caller's own account, as the profile screen needs it.
 *
 * Richer than `UserResponseDto`: that one is the user *directory*, which other
 * people read, so it carries no contact details. This is only ever returned to
 * the account's owner.
 */
export class ProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    description: 'Read-only here — changing it is an admin operation.',
  })
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ type: String, nullable: true })
  phone!: string | null;

  @ApiProperty({ type: String, nullable: true })
  jobTitle!: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty({
    description:
      'Always false: two-factor authentication is not enabled on this deployment. Present so a client can render the control without probing for the field.',
  })
  twoFactorEnabled!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
