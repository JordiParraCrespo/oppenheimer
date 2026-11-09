import { ApiProperty } from '@nestjs/swagger';
import { BotMemoryFactResponseDto } from './bot-memory-fact.response.dto';

export class PersonAboutResponseDto {
  @ApiProperty({
    example: 'I am Jordi. I work from Barcelona and like short answers.',
    description: 'What the person wrote about themselves; empty when nothing was written.',
  })
  about!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When it was last saved; null when it never was.',
  })
  updatedAt!: string | null;
}

export class PersonMemoryResponseDto {
  @ApiProperty({
    type: PersonAboutResponseDto,
    description: "In every one of the person's bots' system prompt; the bots never change it.",
  })
  about!: PersonAboutResponseDto;

  @ApiProperty({
    type: [BotMemoryFactResponseDto],
    description:
      'Every fact about the person (`scope: person`) that any of their bots keeps, newest first. Each is changed on the bot that keeps it (`botId`).',
  })
  facts!: BotMemoryFactResponseDto[];
}
