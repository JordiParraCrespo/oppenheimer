import { ApiProperty } from '@nestjs/swagger';
import type { BotMemoryDream } from '@oppenheimer/shared';

/** A bot's latest dream (`25-bots.md` §4.1, "Dreaming"). */
export class BotMemoryDreamResponseDto implements BotMemoryDream {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'The facts it rewrote: those the bot wrote itself' })
  factsBefore!: number;

  @ApiProperty({ description: 'The facts it wrote in their place' })
  factsAfter!: number;

  @ApiProperty({ type: String, nullable: true, description: 'What it changed, in its words' })
  note!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the owner undid it; null while it stands',
  })
  undoneAt!: string | null;
}

/** `GET /bots/:id/memory/dream`. */
export class BotMemoryDreamStateResponseDto {
  @ApiProperty({ type: BotMemoryDreamResponseDto, nullable: true })
  latest!: BotMemoryDreamResponseDto | null;

  @ApiProperty({
    description:
      'Whether a dream its owner asked for (Tidy now) is under way: from the ask until its job ends, ten minutes at most.',
  })
  pending!: boolean;
}
