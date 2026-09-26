import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** What the machine is: `host_inventory`, as the host row shows it. */
export class HostMachineResponseDto {
  @ApiPropertyOptional({ nullable: true, type: String, example: 'Ubuntu 24.04.1 LTS' })
  osName!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: '6.8.0-45-generic' })
  kernelVersion!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'AMD EPYC 7B13' })
  cpuModel!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number, example: 32 })
  cpuCount!: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number, example: 68719476736 })
  memoryTotalBytes!: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number, example: 1000000000000 })
  diskTotalBytes!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: 'vm',
    description: '`none`, `vm` or `container`, as the runner read it from local files.',
  })
  virtualization!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    example: 'hetzner',
    description: 'The vendor the firmware names; never the answer of a metadata call.',
  })
  cloudProvider!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'Europe/Madrid' })
  timezone!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  bootedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'stable' })
  channel!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'systemd' })
  serviceManager!: string | null;

  @ApiProperty({ description: 'When the machine last changed, not when it last reported.' })
  changedAt!: Date;
}

/** Its last live numbers: `host_presence`. */
export class HostVitalsResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    type: Date,
    description: 'When the current (or last) link opened.',
  })
  connectedAt!: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    example: 41,
    description: 'The link’s last ping/pong.',
  })
  roundTripMillis!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    example: 1.25,
    description: 'One-minute load average.',
  })
  loadAverage!: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  memoryAvailableBytes!: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  diskFreeBytes!: number | null;
}

/**
 * Where the host's current (or last) link came from: the public address the
 * control plane saw, and what DB-IP Lite says about it. Geography requires
 * attribution: "IP geolocation by DB-IP".
 */
export class HostNetworkResponseDto {
  @ApiProperty({ example: '203.0.113.7' })
  ip!: string;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'ES' })
  countryCode!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'Catalonia' })
  region!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'Barcelona' })
  city!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number, example: 24940 })
  asn!: number | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'Hetzner Online GmbH' })
  asnOrg!: string | null;

  @ApiProperty()
  firstSeenAt!: Date;

  @ApiProperty()
  lastSeenAt!: Date;
}

/** One entry of a host's timeline. */
export class HostTimelineEntryResponseDto {
  @ApiProperty({ description: 'Opaque; increases with time.' })
  id!: string;

  @ApiProperty({
    enum: [
      'paired',
      'renamed',
      'unpaired',
      'facts_changed',
      'network_changed',
      'runner_updated',
      'runner_rolled_back',
    ],
  })
  kind!: string;

  @ApiProperty({
    type: Object,
    description:
      '`renamed`: `{ from, to }`. `facts_changed`: `{ changed: { field: [before, after] } }`. `network_changed`: `{ from, to }` networks. `runner_updated`: `{ from, to }` versions.',
  })
  payload!: Record<string, unknown>;

  @ApiProperty()
  occurredAt!: Date;
}

export class HostTimelinePageResponseDto {
  @ApiProperty({ type: [HostTimelineEntryResponseDto] })
  entries!: HostTimelineEntryResponseDto[];

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Pass as `before` for the next, older page; null at the end.',
  })
  next!: string | null;
}
