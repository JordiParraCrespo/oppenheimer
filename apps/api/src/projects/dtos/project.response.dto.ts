import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One repository a project holds, in the project's order. */
export class ProjectRepositoryResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Our `github_installation` row, not GitHub’s number.',
  })
  installationId!: string;

  @ApiProperty({
    description: 'GitHub’s repository id, as a string because the column is a bigint.',
    type: String,
    example: '821374923',
  })
  githubRepoId!: string;

  @ApiProperty({
    description: '`owner/repo` as GitHub spelled it when the project was last saved. Display only.',
    example: 'acme/xrp-mobile',
  })
  repositoryFullName!: string;

  @ApiProperty({ description: 'What a session’s branch is created from.', example: 'main' })
  baseBranch!: string;

  @ApiProperty({ description: 'Offered to a new session. The API never applies it.' })
  isDefault!: boolean;
}

export class ProjectResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({
    description: 'Display name. Free to change; the slug does not follow it.',
    example: 'xrp-mobile',
  })
  name!: string;

  @ApiProperty({
    description:
      'The project’s directory name on every host that holds it. Immutable: derived once, from the name a person gave it or from the repository the API created it for.',
    example: 'xrp-mobile',
  })
  slug!: string;

  @ApiPropertyOptional({
    description:
      'Set only on a project the API created for a repository (a session that named no project): GitHub’s id for that repository, as a string because the column is a bigint.',
    nullable: true,
    type: String,
    example: '821374923',
  })
  originGithubRepoId!: string | null;

  @ApiProperty({ type: [ProjectRepositoryResponseDto] })
  repositories!: ProjectRepositoryResponseDto[];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    type: String,
    description:
      'The host a new session is offered. A suggestion, never a grant: a session on it still needs the caller to be able to use it.',
  })
  defaultHostId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'The agent a new session is offered, from the coding-agent catalog.',
    example: 'claude-code',
  })
  defaultAgent!: string | null;

  @ApiProperty({ description: 'Handed to every new session’s agent. Empty is none.' })
  instructions!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
