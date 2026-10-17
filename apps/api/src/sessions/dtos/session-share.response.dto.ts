import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SESSION_SHARE_ACCESS,
  SESSION_SHARE_AUDIENCES,
  type SessionShareAccess,
  type SessionShareAudience,
} from '@oppenheimer/shared';

/** The person a share acts as. */
export class SessionShareOwnerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  name!: string;

  @ApiProperty({ example: 'ada@example.com' })
  email!: string;
}

/** How a session is shared, as its workspace's members see it. */
export class SessionShareResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({
    description:
      'The share’s address, `/s/<slug>`. It opens nothing on its own: a guest signs in, and is on `people` unless `audience` is `link`.',
  })
  slug!: string;

  @ApiProperty({
    enum: SESSION_SHARE_AUDIENCES,
    description:
      '`people`, only the accounts on `people`; `link`, anyone signed in with the address.',
  })
  audience!: SessionShareAudience;

  @ApiProperty({
    enum: SESSION_SHARE_ACCESS,
    description: '`read` watches the terminal; `write` types into it, as the person who shared it.',
  })
  access!: SessionShareAccess;

  @ApiProperty({ type: [String], description: 'Emails; empty unless `audience` is `people`.' })
  people!: string[];

  @ApiPropertyOptional({ nullable: true, type: Date, description: 'No expiry when `null`.' })
  expiresAt!: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    type: SessionShareOwnerResponseDto,
    description: 'Who shared it, while their account is active.',
  })
  sharedBy!: SessionShareOwnerResponseDto | null;

  @ApiProperty()
  updatedAt!: Date;
}

/** `GET /sessions/{id}/share`: the share, or `null` when the session is not shared. */
export class SessionShareStateResponseDto {
  @ApiPropertyOptional({ nullable: true, type: SessionShareResponseDto })
  share!: SessionShareResponseDto | null;
}

/** What a guest may know about the session a share opens, and nothing more. */
export class SharedSessionResponseDto {
  @ApiProperty({ example: 'Fix the wallet list empty state' })
  name!: string;

  @ApiProperty({
    enum: ['live', 'stopped'],
    description: '`stopped` is tmux gone with the work kept; only a member can restart it.',
  })
  state!: 'live' | 'stopped';

  @ApiProperty({ enum: SESSION_SHARE_ACCESS })
  access!: SessionShareAccess;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Who shared it.' })
  sharedBy!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  expiresAt!: Date | null;
}
