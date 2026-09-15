import { ApiProperty } from '@nestjs/swagger';

/**
 * One signed-in device. The session token itself is never exposed — it is a
 * bearer credential, and listing your own devices must not hand out the means
 * to impersonate them.
 *
 * Only devices reach this shape: the sessions minted for API tokens and OAuth
 * clients are marked `delegated` and filtered out by `SessionRepository`.
 */
export class UserSessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ type: String, nullable: true })
  userAgent!: string | null;

  @ApiProperty({
    description: 'True for the session this request was made with.',
  })
  current!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ description: 'Last time the session was seen.' })
  updatedAt!: Date;

  @ApiProperty()
  expiresAt!: Date;
}
