import { ApiProperty } from '@nestjs/swagger';
import { GITHUB_TOKEN_KINDS, type GithubTokenKind } from '@oppenheimer/shared';

export class GithubTokenRepositoryDto {
  @ApiProperty({ description: 'GitHub’s own repository id.', example: 831004242 })
  githubRepoId!: number;

  @ApiProperty({ example: 'acme-labs/billing' })
  fullName!: string;

  @ApiProperty()
  private!: boolean;
}

/** One of the caller's own GitHub tokens. Its secret is never answered. */
export class GithubTokenResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'acme: billing repo' })
  label!: string;

  @ApiProperty({
    enum: GITHUB_TOKEN_KINDS,
    description: 'From GitHub’s prefix: `github_pat_` fine-grained, `ghp_` classic.',
  })
  kind!: GithubTokenKind;

  @ApiProperty({ description: 'The GitHub account the token belongs to.', example: 'jordiparra' })
  login!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'A classic token’s scopes, as GitHub lists them; null for the others.',
    example: 'repo, read:org',
  })
  scopes!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Null for a token GitHub says never expires.',
  })
  expiresAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'When GitHub was last asked.' })
  checkedAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When GitHub last refused the token; null while it is accepted.',
  })
  refusedAt!: string | null;

  @ApiProperty({ description: 'Not refused and not past its expiry: it can be chosen to read.' })
  usable!: boolean;

  @ApiProperty({
    type: [GithubTokenRepositoryDto],
    description: 'What the token opened when it was last checked, archived ones aside.',
  })
  repositories!: GithubTokenRepositoryDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

/** A repository the caller's tokens open, and the token that reads it now. */
export class GithubTokenReadsResponseDto {
  @ApiProperty({ description: 'GitHub’s own repository id.', example: 831004242 })
  githubRepoId!: number;

  @ApiProperty({ example: 'acme-labs/billing' })
  fullName!: string;

  @ApiProperty()
  private!: boolean;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'The token that reads it now; null when no token that still works opens it.',
  })
  tokenId!: string | null;

  @ApiProperty({ description: 'Whether the caller pinned that token to this repository.' })
  pinned!: boolean;
}
