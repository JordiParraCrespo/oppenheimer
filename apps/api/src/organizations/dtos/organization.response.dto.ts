import { ApiProperty } from '@nestjs/swagger';

export class OrganizationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ nullable: true, type: String })
  logo!: string | null;

  @ApiProperty({
    nullable: true,
    type: 'object',
    additionalProperties: true,
    description: 'Free-form JSON metadata.',
  })
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;
}

export class MemberUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  image!: string | null;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  emailVerified!: boolean;
}

export class MemberResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({
    description: 'Organization role (owner | admin | member | custom).',
  })
  role!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true, type: MemberUserResponseDto })
  user!: MemberUserResponseDto | null;
}

/** A pending invitation to join an organization. */
export class InvitationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  role!: string | null;

  @ApiProperty({ description: 'pending | accepted | rejected | canceled.' })
  status!: string;

  @ApiProperty({ nullable: true, type: String })
  teamId!: string | null;

  @ApiProperty()
  inviterId!: string;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  createdAt!: Date;
}

export class FullOrganizationResponseDto extends OrganizationResponseDto {
  @ApiProperty({ type: [MemberResponseDto] })
  members!: MemberResponseDto[];

  @ApiProperty({ type: [InvitationResponseDto] })
  invitations!: InvitationResponseDto[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: 'Workspaces (Better Auth teams) in this organization.',
  })
  teams!: Record<string, unknown>[];
}

export class SlugAvailabilityResponseDto {
  @ApiProperty({ description: 'True when the slug is available.' })
  available!: boolean;
}
