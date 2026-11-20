import { ApiProperty } from '@nestjs/swagger';

export class BotActivityResponseDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'The bots with a turn queued or running, in no order.',
  })
  working!: string[];

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'The bots waiting on you, in no order: an approval or a card of questions pending, or, while not working, a turn that failed since you last read the chat.',
  })
  waitingOnYou!: string[];
}
