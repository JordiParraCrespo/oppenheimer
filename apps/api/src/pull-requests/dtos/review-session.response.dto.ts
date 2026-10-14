import { ApiProperty } from '@nestjs/swagger';

/** `POST /pulls/…/review-session`: the session it started. */
export class ReviewSessionStartedResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({
    type: [String],
    description:
      'What the control plane could not do just now: `host_offline` when the session waits for its host.',
  })
  hints!: string[];
}

/** `GET /pulls/review-sessions`: one of the caller's open review sessions. */
export class ReviewSessionDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ format: 'uuid', description: 'The installation that reaches the repository.' })
  installationId!: string;

  @ApiProperty()
  githubRepoId!: number;

  @ApiProperty()
  number!: number;

  @ApiProperty({
    example: 'acme-labs/xrp-mobile',
    description: 'As it was when the session started.',
  })
  repository!: string;

  @ApiProperty({ description: 'The pull request’s title when the session started.' })
  title!: string;

  @ApiProperty({ example: 'fix/wallet-empty-state' })
  headRef!: string;

  @ApiProperty({ format: 'uuid' })
  hostId!: string;

  @ApiProperty({
    enum: ['starting', 'open', 'failed'],
    description: 'The session’s stored lifecycle.',
  })
  state!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
