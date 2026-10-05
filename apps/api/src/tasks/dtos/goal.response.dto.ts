import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GoalResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  projectId!: string;

  @ApiProperty({ example: 'Ship XRP Mobile 2.0 to TestFlight' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date', example: '2026-11-01' })
  targetDate!: string | null;

  @ApiProperty({ description: 'Its tasks that are Done.' })
  doneCount!: number;

  @ApiProperty({ description: 'All its tasks.' })
  totalCount!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
