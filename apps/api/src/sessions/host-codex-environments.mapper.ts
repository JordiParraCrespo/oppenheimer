import type { HostCodexEnvironments } from './application/host-codex-environments.port';
import { HostCodexEnvironmentsResponseDto } from './dtos/host-codex-environments.response.dto';

/** A host's Codex cloud environments, as the composer's picker reads them. */
export class HostCodexEnvironmentsMapper {
  /** The runner's list, absent labels and recommendation spelled as null. */
  static toResponse(listing: HostCodexEnvironments): HostCodexEnvironmentsResponseDto {
    const dto = new HostCodexEnvironmentsResponseDto();
    dto.environments = listing.environments.map((env) => ({
      id: env.id,
      label: env.label ?? null,
      pinned: env.pinned,
      repository: env.repository,
    }));
    dto.recommended = listing.recommended ?? null;
    dto.source = listing.source;
    return dto;
  }
}
