import { ApiProperty } from '@nestjs/swagger';
import { BOT_AUTHORS, type BotAuthor } from '@oppenheimer/shared';

export class BotSkillResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: 'release-notes',
    description: 'Lowercase letters, digits and hyphens: the slash command that runs it.',
  })
  name!: string;

  @ApiProperty({
    example: 'Writes release notes from the pull requests merged since the last tag.',
    description: 'When to use it; every turn of the bot lists it.',
  })
  description!: string;

  @ApiProperty({
    description: 'The skill itself, in Markdown: the steps, the checks, what to report.',
  })
  body!: string;

  @ApiProperty({ description: 'The person may run it by typing `/<name>` in the chat.' })
  userInvocable!: boolean;

  @ApiProperty({ description: "The bot's prompt lists it, so the bot may use it unasked." })
  modelInvocable!: boolean;

  @ApiProperty({ enum: BOT_AUTHORS, description: 'Who wrote it last.' })
  source!: BotAuthor;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
