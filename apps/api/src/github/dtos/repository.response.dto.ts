import { ApiProperty } from '@nestjs/swagger';

/**
 * Nothing here is stored, so `githubRepoId` is the only durable handle: a
 * checkout keys on it and keeps the name only as a display snapshot.
 */
export class RepositoryResponseDto {
  @ApiProperty({ description: 'GitHub’s own repository id.', example: 831004242 })
  githubRepoId!: number;

  @ApiProperty({ example: 'oppenheimer' })
  name!: string;

  @ApiProperty({ example: 'acme-labs/oppenheimer' })
  fullName!: string;

  @ApiProperty({ example: 'main', description: 'Offered as the default base branch.' })
  defaultBranch!: string;

  @ApiProperty()
  private!: boolean;

  @ApiProperty({ description: 'Archived on GitHub: readable, but pushes are refused.' })
  archived!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When GitHub last saw a push, for ordering the picker.',
  })
  pushedAt!: string | null;
}

export class RepositoryBranchResponseDto {
  @ApiProperty({ example: 'main' })
  name!: string;

  @ApiProperty({ example: 'd6cd1e2bd19e03a81132a23b2025920577f84e37' })
  commitSha!: string;

  @ApiProperty({ description: 'Whether a branch protection rule applies.' })
  protected!: boolean;

  @ApiProperty({ description: 'Whether this is the repository’s default branch.' })
  isDefault!: boolean;
}
