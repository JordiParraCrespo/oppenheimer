import { ApiProperty } from '@nestjs/swagger';

export class WorkingBotsResponseDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'The bots with a turn queued or running, in no order.',
  })
  botIds!: string[];
}
