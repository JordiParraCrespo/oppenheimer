import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * What `POST /hosts/register` answers — the runner's `RegisterResponse`
 * (`apps/runner/internal/pairing/app/ports.go`), field for field.
 *
 * `fingerprint` is the **control plane's** key, not the host's: the runner pins
 * it at registration and refuses to speak to anything that cannot present it
 * afterwards (F6). The host's own fingerprint is something it computes locally
 * and never needs told.
 */
export class HostRegistrationResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The host this machine now is.' })
  hostId!: string;

  @ApiProperty({
    description: 'SHA-256 of the control plane’s Ed25519 public key, hex. The runner pins it.',
  })
  fingerprint!: string;

  @ApiPropertyOptional({
    description: 'The release channel this host follows.',
    example: 'stable',
  })
  channel?: string;

  @ApiPropertyOptional({
    description: 'Where the runner fetches signed release artifacts from.',
    example: 'https://releases.oppenheimer.dev',
  })
  releaseBaseUrl?: string;
}
