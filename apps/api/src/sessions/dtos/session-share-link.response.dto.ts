import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SHARE_LINK_ACCESS,
  SHARE_LINK_AUDIENCES,
  type ShareLinkAccess,
  type ShareLinkAudience,
} from '@oppenheimer/shared';

/** A share link as its session's members see it. Never carries the secret. */
export class ShareLinkResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({
    enum: SHARE_LINK_ACCESS,
    description: '`read` watches the terminal; `write` types into it, as the person who shared it.',
  })
  access!: ShareLinkAccess;

  @ApiProperty({
    enum: SHARE_LINK_AUDIENCES,
    description:
      '`anyone` with the link; `accounts`, anyone signed in; `people`, only the accounts on `people`.',
  })
  audience!: ShareLinkAudience;

  @ApiProperty({ type: [String], description: 'Emails; empty unless `audience` is `people`.' })
  people!: string[];

  @ApiPropertyOptional({ nullable: true, type: String })
  label!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  expiresAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  revokedAt!: Date | null;

  @ApiProperty({ description: 'Neither revoked nor expired.' })
  live!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

/** The answer to a create: the link, and the secret that opens it, once. */
export class CreatedShareLinkResponseDto extends ShareLinkResponseDto {
  @ApiProperty({
    description:
      'The link’s secret. Shown once and never again: only its digest is stored. The console puts it in the URL fragment, `/shared#<token>`.',
  })
  token!: string;
}

/** What a link's holder may know about the session it opens, and nothing more. */
export class SharedSessionResponseDto {
  @ApiProperty({ example: 'Fix the wallet list empty state' })
  name!: string;

  @ApiProperty({
    enum: ['live', 'stopped'],
    description: '`stopped` is tmux gone with the work kept; only a member can restart it.',
  })
  state!: 'live' | 'stopped';

  @ApiProperty({ enum: SHARE_LINK_ACCESS })
  access!: ShareLinkAccess;

  @ApiPropertyOptional({ nullable: true, type: String, description: 'Who shared it.' })
  sharedBy!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  expiresAt!: Date | null;
}
