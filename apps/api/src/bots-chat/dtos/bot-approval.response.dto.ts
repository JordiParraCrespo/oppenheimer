import { ApiProperty } from '@nestjs/swagger';
import { nullableEnum } from '@oppenheimer/backend-core';
import {
  BOT_APPROVAL_REACHES,
  BOT_APPROVAL_STATUSES,
  type BotApprovalReach,
  type BotApprovalStatus,
} from '@oppenheimer/shared';

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

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'What kind of thing the call acts on (`repository`, `session`); null when none.',
  })
  subjectKind!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The thing the call acts on, by name: what "Always allow for …" covers.',
  })
  subjectLabel!: string | null;

  @ApiProperty({ description: 'The call sends data out of Oppenheimer.' })
  sharesOutside!: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Why a rule paused the call, when one did.',
  })
  reviewNote!: string | null;

  @ApiProperty({
    enum: BOT_APPROVAL_REACHES,
    isArray: true,
    description: 'How far a yes may reach: this call, its subject, the tool.',
  })
  reaches!: BotApprovalReach[];

  @ApiProperty({ ...nullableEnum(BOT_APPROVAL_REACHES), description: 'How far the yes went.' })
  reach!: BotApprovalReach | null;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  decidedByUserId!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  decidedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
