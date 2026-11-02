import { ApiProperty } from '@nestjs/swagger';
import {
  CI_FINDING_ACTIONS,
  CI_FINDING_CONFIDENCE,
  CI_FINDING_FLAKE,
  CI_FINDING_RELATIONS,
  type CiFindingAction,
  type CiFindingConfidence,
  type CiFindingFlake,
  type CiFindingRelation,
} from '@oppenheimer/shared';

/** What one failing check on the head came to (`0.2-pull-requests.md`, "CI findings"). */
export class CiFindingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'The check, as GitHub names it.' })
  check!: string;

  @ApiProperty({ description: 'The head commit it failed on.' })
  headSha!: string;

  @ApiProperty({ description: 'Why it failed.' })
  rootCause!: string;

  @ApiProperty({
    enum: CI_FINDING_RELATIONS,
    description: '`this_change`: the pull request caused it; `unrelated`: it fails without it.',
  })
  relation!: CiFindingRelation;

  @ApiProperty({ enum: CI_FINDING_FLAKE })
  flake!: CiFindingFlake;

  @ApiProperty({ enum: CI_FINDING_ACTIONS })
  action!: CiFindingAction;

  @ApiProperty({ description: 'The action in words.' })
  next!: string;

  @ApiProperty({ enum: CI_FINDING_CONFIDENCE })
  confidence!: CiFindingConfidence;

  @ApiProperty({ type: [String], description: 'What it rests on: log lines, files, runs.' })
  evidence!: string[];

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'The bot that recorded it; null when a person did, or the bot is gone.',
  })
  recordedByBotId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}
