import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeadResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  teamId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  ownerId!: string | null;

  @ApiProperty({ example: 'Acme Corp' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  email!: string | null;

  @ApiProperty({ description: 'Deal value in minor units.', example: 250000 })
  value!: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  notes!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
