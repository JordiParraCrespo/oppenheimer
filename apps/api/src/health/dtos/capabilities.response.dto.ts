import { ApiProperty } from '@nestjs/swagger';
import type { ClientCapabilities } from '@oppenheimer/shared';

/**
 * The client-facing capabilities of this deployment, resolved from config once
 * at boot. `false` means "not configured on this install", not an outage.
 *
 * Deliberately a subset of the full registry: only capabilities a client hides
 * or shows UI for belong on this public wire response. Server-internal ones
 * (`s3_storage`, `email_delivery`) stay in the startup log and the in-process
 * `CapabilitiesService`.
 */
export class CapabilitiesResponseDto implements ClientCapabilities {
  @ApiProperty({ description: 'Sign-in with Google is configured.' })
  google_oauth!: boolean;

  @ApiProperty({ description: 'Sign-in with GitHub is configured.' })
  github_oauth!: boolean;

  @ApiProperty({ description: 'Stripe billing is configured.' })
  stripe_billing!: boolean;

  @ApiProperty({ description: 'The sessions GitHub App is configured.' })
  github_app!: boolean;
}
