import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HOST_STATUSES, type HostStatus } from '@oppenheimer/shared';
import {
  HostMachineResponseDto,
  HostNetworkResponseDto,
  HostVitalsResponseDto,
} from './host-metadata.response.dto';

export class HostResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The person who paired this machine. A host has no workspace.',
  })
  ownerUserId!: string;

  @ApiProperty({ example: 'Dev box' })
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'jordis-macbook.local' })
  hostname!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'macos' })
  os!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'arm64' })
  arch!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: '0.3.1' })
  runnerVersion!: string | null;

  @ApiPropertyOptional({
    description:
      'What the runner last reported: the tools it found and their versions, the agents on PATH, free disk. A hint for the UI, never a gate — a session opens on a machine without the agent installed.',
    type: Object,
    nullable: true,
  })
  capabilities!: Record<string, unknown> | null;

  @ApiProperty({
    description: 'SHA-256 of the host’s Ed25519 public key, hex. The key itself stays server-side.',
    example: '9f2c…',
  })
  publicKeyFingerprint!: string;

  @ApiProperty({
    description:
      'Whether the runner has sent a heartbeat recently enough to be considered attached. Derived on read, never stored.',
  })
  online!: boolean;

  @ApiProperty({
    enum: HOST_STATUSES,
    enumName: 'HostStatus',
    description:
      'One word for the row: `running` (online with a session whose agent is up), `idle` (online, nothing running), `offline` (no recent heartbeat) or `unpaired`. Derived on read from `online`, `runningSessionCount` and `unpairedAt`.',
  })
  status!: HostStatus;

  @ApiProperty({
    minimum: 0,
    description:
      'Sessions on this host that are neither stopped nor resolved — what removing the host would stop. Counted across every workspace, because the host is one person’s.',
  })
  runningSessionCount!: number;

  @ApiPropertyOptional({
    nullable: true,
    type: Boolean,
    description:
      'Whether the host can start a Claude Code cloud session now: online, its runner takes `session.cloud`, and `claude` is installed. Null when online but not known on the replica that answered.',
  })
  startsCloudSessions!: boolean | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      'The claude.ai account (email) the host’s `claude` is signed in as: the account a Claude Code cloud session started there runs on. Null when it is not signed in, or its runner does not report it.',
  })
  claudeAccount!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  lastSeenAt!: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    type: () => HostMachineResponseDto,
    description: 'What the machine is. Null until the runner has reported its facts.',
  })
  machine!: HostMachineResponseDto | null;

  @ApiPropertyOptional({
    nullable: true,
    type: () => HostVitalsResponseDto,
    description: 'Its last live numbers. Null until its first link.',
  })
  vitals!: HostVitalsResponseDto | null;

  @ApiPropertyOptional({
    nullable: true,
    type: () => HostNetworkResponseDto,
    description: 'Where its current (or last) link came from. Null until one has.',
  })
  network!: HostNetworkResponseDto | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Date,
    description: 'When the host was unpaired. The row is kept so its history survives.',
  })
  unpairedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
