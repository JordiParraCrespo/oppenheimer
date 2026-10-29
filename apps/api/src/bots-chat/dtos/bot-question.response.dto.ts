import { ApiProperty } from '@nestjs/swagger';
import { BOT_QUESTION_STATUSES, type BotQuestionStatus } from '@oppenheimer/shared';

/** One option of a question. */
export class BotQuestionOptionResponseDto {
  @ApiProperty()
  label!: string;

  @ApiProperty({ type: String, nullable: true, description: 'What picking it means.' })
  description!: string | null;
}

/** One question of a card, the shape of Claude Code's `AskUserQuestion`. */
export class BotQuestionItemResponseDto {
  @ApiProperty({ type: String, nullable: true, description: 'A tag over it ("Repo").' })
  header!: string | null;

  @ApiProperty()
  question!: string;

  @ApiProperty({ description: 'Several options may be picked.' })
  multiSelect!: boolean;

  @ApiProperty({ type: [BotQuestionOptionResponseDto] })
  options!: BotQuestionOptionResponseDto[];
}

/** One question's answer: the options picked, by index, and the person's own words. */
export class BotQuestionAnswerResponseDto {
  @ApiProperty({ type: [Number] })
  picks!: number[];

  @ApiProperty({ type: String, nullable: true })
  other!: string | null;
}

/** A card of questions a bot put to its owner (`ask_user`). */
export class BotQuestionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The turn whose call asked.' })
  turnId!: string;

  @ApiProperty({ type: [BotQuestionItemResponseDto] })
  questions!: BotQuestionItemResponseDto[];

  @ApiProperty({ description: 'The card’s line: the first question, and how many follow.' })
  summary!: string;

  @ApiProperty({ enum: BOT_QUESTION_STATUSES })
  status!: BotQuestionStatus;

  @ApiProperty({
    type: [BotQuestionAnswerResponseDto],
    nullable: true,
    description: 'One per question, once answered.',
  })
  answers!: BotQuestionAnswerResponseDto[] | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'What the person added to a dismissal.',
  })
  note!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  decidedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

/** `GET /bots/:id/question`: the card that waits, if one does. */
export class BotPendingQuestionResponseDto {
  @ApiProperty({ type: BotQuestionResponseDto, nullable: true })
  question!: BotQuestionResponseDto | null;
}
