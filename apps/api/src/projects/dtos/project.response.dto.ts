import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProjectResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ example: 'xrp-mobile' })
  name!: string;

  @ApiProperty({
    description:
      'The project’s directory name on every host that holds it. Immutable, and never reused once archived.',
    example: 'xrp-mobile',
  })
  slug!: string;

  @ApiPropertyOptional({
    description: 'GitHub id of the repository whose first session created the project.',
    nullable: true,
    type: Number,
  })
  originGithubRepoId!: number | null;

  @ApiPropertyOptional({
    description: 'When the project was archived. Projects are never deleted.',
    nullable: true,
    type: Date,
  })
  archivedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
