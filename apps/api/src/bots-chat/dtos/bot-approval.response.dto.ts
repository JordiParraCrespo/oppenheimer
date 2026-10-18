import { ApiProperty } from '@nestjs/swagger';
import { BOT_APPROVAL_STATUSES, type BotApprovalStatus } from '@oppenheimer/shared';

/** A Needs input card: one call of an asking tool, waiting for the owner or decided. */
export class BotApprovalResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The turn whose tool call asked.' })
  turnId!: string;

  @ApiProperty({ description: 'The tool, as the bot knows it (`start_session`).' })
  tool!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The call exactly as it will run on a yes.',
  })
  input!: Record<string, unknown>;

  @ApiProperty({ description: 'What will happen, in words.' })
  summary!: string;

  @ApiProperty({
    description:
      'The digest of this card’s call (its id, tool and input). An approval names it, so it approves exactly the call shown.',
  })
  callDigest!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Past this a pending card can no longer be decided: it expires.',
  })
  expiresAt!: string;

  @ApiProperty({ enum: BOT_APPROVAL_STATUSES })
  status!: BotApprovalStatus;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What the call answered when it ran on a yes; null before, and for a no.',
  })
  result!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'What the person added to a no.' })
  note!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  decidedByUserId!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  decidedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
