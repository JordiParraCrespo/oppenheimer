import { ApiProperty } from '@nestjs/swagger';
import {
  CLOUD_AGENT_PROVIDERS,
  CLOUD_AGENT_STATUSES,
  type CloudAgentProviderId,
  type CloudAgentStatus,
} from '@oppenheimer/shared';

/** A cloud agent as the console lists and opens it. */
export class CloudAgentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CLOUD_AGENT_PROVIDERS })
  provider!: CloudAgentProviderId;

  @ApiProperty({ description: 'The vendor’s id for the agent.', example: 'bc-7f1c…' })
  externalId!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The agent’s own page at the vendor.',
  })
  url!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'The prompt it was launched with.' })
  prompt!: string;

  @ApiProperty({ example: 'https://github.com/acme/api' })
  repositoryUrl!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Null is the default branch.' })
  startingRef!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Null is the vendor’s default.' })
  model!: string | null;

  @ApiProperty()
  autoCreatePr!: boolean;

  @ApiProperty({
    enum: CLOUD_AGENT_STATUSES,
    description: 'Where its latest run stands. `starting` and `running` still move.',
  })
  status!: CloudAgentStatus;

  @ApiProperty({ type: String, nullable: true, description: 'The branch it pushed.' })
  branch!: string | null;

  @ApiProperty({ type: String, nullable: true })
  pullRequestUrl!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The agent’s last reply, once its latest run ended.',
  })
  summary!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'When the vendor was last asked about the run.',
  })
  syncedAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
