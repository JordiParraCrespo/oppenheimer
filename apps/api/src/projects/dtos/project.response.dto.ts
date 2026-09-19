import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({
    description: 'The GitHub repository’s name, as GitHub spells it. Display only.',
    example: 'xrp-mobile',
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
      'GitHub’s id for the repository whose first session created the project, as a string because the column is a bigint.',
    nullable: true,
    type: String,
    example: '821374923',
  })
  originGithubRepoId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
