import { ApiProperty } from '@nestjs/swagger';
import { CLOUD_AGENT_PROVIDERS, type CloudAgentProviderId } from '@oppenheimer/shared';

/** One vendor, and whether the caller can launch on it. */
export class CloudAgentProviderStatusDto {
  @ApiProperty({ enum: CLOUD_AGENT_PROVIDERS })
  id!: CloudAgentProviderId;

  @ApiProperty({ example: 'Cursor' })
  label!: string;

  @ApiProperty({ description: 'Whether the caller stored a key for it.' })
  connected!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The name the key has at the vendor.',
  })
  keyName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'The key’s last four characters.' })
  keyHint!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'The vendor account it is.' })
  accountEmail!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  connectedAt!: string | null;
}

/** `GET /cloud-agents/status`: what the console shows Cloud agents from. */
export class CloudAgentStatusResponseDto {
  @ApiProperty({
    description:
      'Whether this server can keep a vendor key at all (`CLOUD_AGENTS_KEY`). False: connecting answers CLOUD_AGENTS_003.',
  })
  configured!: boolean;

  @ApiProperty({ description: 'Whether the caller can launch on at least one vendor.' })
  available!: boolean;

  @ApiProperty({ type: [CloudAgentProviderStatusDto], description: 'Every vendor, in order.' })
  providers!: CloudAgentProviderStatusDto[];
}
