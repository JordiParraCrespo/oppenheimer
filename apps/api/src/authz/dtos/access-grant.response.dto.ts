import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AccessGrantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ enum: ['user', 'team', 'role'] })
  principalType!: string;

  @ApiProperty({ format: 'uuid' })
  principalId!: string;

  @ApiProperty({ example: 'Lead', description: 'A registry subject.' })
  resourceType!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'Null grants every resource of that type within the organization.',
  })
  resourceId!: string | null;

  @ApiProperty({ format: 'uuid' })
  grantedBy!: string;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  expiresAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}
