import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PairingTokenResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    description: 'The name the machine will adopt when it registers with this token.',
    example: 'Dev box',
  })
  name!: string;

  @ApiProperty({
    description: 'Non-secret display prefix. The secret is shown once, in the install command.',
    example: 'opr_reg_a1b2c3',
  })
  prefix!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      'Where the token was minted from. Behind a proxy this is the real client only once TRUST_PROXY names the hop count.',
  })
  createdFromIp!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Where it was spent from — a different fact from where it was minted.',
  })
  redeemedFromIp!: string | null;

  @ApiProperty()
  expiresAt!: Date;

  @ApiPropertyOptional({ nullable: true, type: Date })
  revokedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  redeemedAt!: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'The host this token created.',
  })
  redeemedHostId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

/**
 * Returned only by `POST /v1/hosts/pairing`. This is the single moment the
 * secret exists outside the caller's hands: it is embedded in the install
 * command and only its digest is stored, so nothing can recover it afterwards.
 *
 * The command and the prompt are templated from deploy-owned configuration, not
 * from anything a workspace can write — a workspace-writable install string
 * would be remote code execution on somebody's laptop.
 */
export class MintedPairingTokenResponseDto extends PairingTokenResponseDto {
  @ApiProperty({
    description: 'The one-line command that installs and registers the runner on the machine.',
    example: 'curl -fsSL https://get.oppenheimer.dev/install.sh | sh -s -- --token opr_reg_…',
  })
  installCommand!: string;

  @ApiProperty({
    description:
      'The same instruction phrased for a coding agent already running on the machine, for someone who would rather paste it there.',
  })
  agentPrompt!: string;
}
