import { ApiProperty } from '@nestjs/swagger';

/** One of the caller's Gmail accounts, as Settings lists it. Never the token. */
export class GmailConnectionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ana@gmail.com' })
  accountEmail!: string;

  @ApiProperty({
    example: 'Personal',
    description: 'What the person and their bots call the account.',
  })
  label!: string;

  @ApiProperty({
    enum: ['active', 'revoked'],
    description: '`revoked` when Google dropped the grant: the account offers Reconnect.',
  })
  status!: 'active' | 'revoked';

  @ApiProperty({ type: String, format: 'date-time', description: 'When it was first connected.' })
  connectedAt!: string;
}

/** Where Connect Gmail sends the browser. */
export class GmailConnectStartResponseDto {
  @ApiProperty({ description: 'Google’s consent page, carrying the single-use state.' })
  url!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;
}
