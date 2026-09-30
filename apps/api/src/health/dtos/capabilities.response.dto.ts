import { ApiProperty } from '@nestjs/swagger';
import type { ClientDeployment } from '@oppenheimer/shared';

/**
 * The client-facing capabilities of this deployment, resolved from config once
 * at boot; `DeploymentCapabilities` says what `false` means.
 *
 * Deliberately a subset of the full registry: only `CLIENT_CAPABILITIES`, the
 * ones a client hides or shows UI for, belong on this public wire response. The
 * rest stay in the startup log and the in-process `CapabilitiesService`.
 */
export class CapabilitiesResponseDto implements ClientDeployment {
  @ApiProperty({ description: 'Sign-in with Google is configured.' })
  google_oauth!: boolean;

  @ApiProperty({ description: 'Sign-in with GitHub is configured.' })
  github_oauth!: boolean;

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
