import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ nullable: true, type: Date })
  lastSeenAt!: Date | null;

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
