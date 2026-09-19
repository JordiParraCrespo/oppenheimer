import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InstallationResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The control-plane id. Everything but the connect body uses this.',
  })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({
    description: 'GitHub’s own installation id.',
    example: 45678901,
  })
  githubInstallationId!: number;

  @ApiProperty({ example: 'acme-labs', description: 'The account the App is installed on.' })
  accountLogin!: string;

  @ApiProperty({ example: 'Organization', enum: ['User', 'Organization'] })
  accountType!: string;

  @ApiProperty({
    enum: ['all', 'selected'],
    description: 'What the installation dialog granted. GitHub enforces it, not us.',
  })
  repositorySelection!: 'all' | 'selected';

  @ApiProperty({ format: 'uuid', description: 'The account that connected it.' })
  installedByUserId!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: Date,
    description:
      'Set while GitHub reports the installation suspended; nothing resolves until it clears.',
  })
  suspendedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
