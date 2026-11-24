import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { nullableEnum } from '@oppenheimer/backend-core';
import {
  AUTOMATION_SKIP_REASONS,
  type AutomationSkipReason,
} from '@oppenheimer/shared/automations';

/** A routine's webhook as its Routines tab shows it: never the URL or the secret, which are shown once. */
export class RoutineWebhookResponseDto {
  @ApiProperty({ example: 'owh_ab12cd', description: 'The start of the URL’s token.' })
  tokenPrefix!: string;

  @ApiProperty({ description: 'Whether a request must carry a signature.' })
  signed!: boolean;

  @ApiProperty({ description: 'When the current URL was issued.' })
  issuedAt!: Date;

  @ApiPropertyOptional({ nullable: true, type: Date })
  lastReceivedAt!: Date | null;
}

/** A URL just issued: the only time its token and signing secret are answered. */
export class IssuedRoutineWebhookResponseDto extends RoutineWebhookResponseDto {
  @ApiProperty({ example: 'https://api.example.com/api/v1/routine-webhooks/owh_…' })
  url!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'The signing secret, when one was asked for. Not shown again.',
  })
  signingSecret!: string | null;
}

/** What a POST to a routine's webhook made: a run, answered before the bot starts. */
export class RoutineWebhookReceivedResponseDto {
  @ApiProperty({ format: 'uuid' })
  runId!: string;

  @ApiProperty({
    enum: ['queued', 'skipped', 'duplicate'],
    description:
      '`queued`: the bot will run. `skipped`: an hourly cap turned it away, recorded on the run. `duplicate`: an earlier POST with this `Idempotency-Key` made the run.',
  })
  status!: 'queued' | 'skipped' | 'duplicate';

  @ApiPropertyOptional(nullableEnum(AUTOMATION_SKIP_REASONS))
  skipReason!: AutomationSkipReason | null;
}
