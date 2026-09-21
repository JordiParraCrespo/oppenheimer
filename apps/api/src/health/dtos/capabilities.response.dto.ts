import { ApiProperty } from '@nestjs/swagger';
import type { ClientDeployment } from '@oppenheimer/shared';

/**
 * The client-facing capabilities of this deployment, resolved from config once
 * at boot. `false` means "not configured on this install", not an outage.
 *
 * Deliberately a subset of the full registry: only capabilities a client hides
 * or shows UI for belong on this public wire response. Server-internal ones
 * (`s3_storage`, `email_delivery`) stay in the startup log and the in-process
 * `CapabilitiesService`.
 */
export class CapabilitiesResponseDto implements ClientDeployment {
  @ApiProperty({ description: 'Sign-in with Google is configured.' })
  google_oauth!: boolean;

  @ApiProperty({ description: 'Sign-in with GitHub is configured.' })
  github_oauth!: boolean;

  @ApiProperty({ description: 'Stripe billing is configured.' })
  stripe_billing!: boolean;

  @ApiProperty({ description: 'The sessions GitHub App is configured.' })
  github_app!: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'https://github.com/apps/oppenheimer/installations/new',
    description:
      "Where Connect GitHub sends the browser, built from the App's slug. `null` when no App is configured — a console must not offer an install page that does not exist. Served here so the browser needs no copy of the slug.",
  })
  github_app_install_url!: string | null;
}
