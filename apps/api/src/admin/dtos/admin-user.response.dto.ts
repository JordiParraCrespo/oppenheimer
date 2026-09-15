import { ApiProperty } from '@nestjs/swagger';

/** A user as seen by the admin (super-admin) API. */
export class AdminUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Global role name(s).',
  })
  role!: string | null;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty()
  banned!: boolean;

  @ApiProperty({ nullable: true, type: String })
  banReason!: string | null;

  @ApiProperty({ nullable: true, type: Date })
  banExpires!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

/** Paginated list of users. */
export class AdminUserListResponseDto {
  @ApiProperty({ type: [AdminUserResponseDto] })
  users!: AdminUserResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty({ nullable: true, type: Number })
  limit!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  offset!: number | null;
}

/** A user session (admin session listing). */
export class AdminSessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  // The session token is deliberately NOT exposed: it is a bearer credential
  // that the `bearer` plugin accepts as `Authorization: Bearer <token>`, so
  // returning it would let this read-only listing hand out the means to
  // impersonate any device. Revocation works by session id server-side.

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty({ nullable: true, type: String })
  ipAddress!: string | null;

  @ApiProperty({ nullable: true, type: String })
  userAgent!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

/** Result of a generic admin mutation that only reports success. */
export class AdminSuccessResponseDto {
  @ApiProperty()
  success!: boolean;
}
