import { ApiProperty } from '@nestjs/swagger';

export class BotGroupResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Engineering' })
  name!: string;

  @ApiProperty({ description: 'Its order in the sidebar, from 0.' })
  position!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
