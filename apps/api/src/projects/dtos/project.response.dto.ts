import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CODING_AGENT_IDS, type CodingAgentId } from '@oppenheimer/shared/agents';

export class ProjectRepositoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The GitHub installation this repository’s tokens are minted through.',
  })
  installationId!: string;

  @ApiProperty({
    description: 'GitHub’s repository id, as a string because the column is a bigint.',
    example: '821374923',
  })
  githubRepoId!: string;

  @ApiProperty({
    description: 'A display snapshot of `owner/repo`, refreshed whenever the project is saved.',
    example: 'acme/xrp-mobile',
  })
  fullName!: string;

  @ApiProperty({ description: 'Cloned into every new session of the project.' })
  isDefault!: boolean;

  @ApiPropertyOptional({
    description:
      'What those sessions branch from. Null is the repository’s own default branch, read live.',
    nullable: true,
    type: String,
    example: 'main',
  })
  baseBranch!: string | null;
}

export class ProjectResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({
    description:
      'The display name: what the person called it, or the repository’s name for a project a first session created.',
    example: 'XRP Mobile',
  })
  name!: string;

  @ApiProperty({
    description:
      'The project’s directory name on every host that holds it. Immutable, and derived from the repository: `<repo>`, or `<owner>--<repo>` when another repository already holds that name.',
    example: 'xrp-mobile',
  })
  slug!: string;

  @ApiPropertyOptional({
    description:
      'GitHub’s id for the repository whose first session created the project, as a string because the column is a bigint. Null for a project made on the console.',
    nullable: true,
    type: String,
    example: '821374923',
  })
  originGithubRepoId!: string | null;

  @ApiPropertyOptional({
    description:
      'The host New session picks first for this project. Null is the composer’s last choice.',
    nullable: true,
    type: String,
    format: 'uuid',
  })
  defaultHostId!: string | null;

  @ApiPropertyOptional({
    description:
      'The agent New session picks first for this project. Null is the composer’s last choice.',
    nullable: true,
    enum: CODING_AGENT_IDS,
  })
  defaultAgent!: CodingAgentId | null;

  @ApiProperty({
    type: [ProjectRepositoryResponseDto],
    description: 'The repositories the project holds, in the order they were added.',
  })
  repositories!: ProjectRepositoryResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
