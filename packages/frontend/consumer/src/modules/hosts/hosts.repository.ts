import { heyApiClient } from '@oppenheimer/api-client';
import { AppError, MapApiError } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { HostEntity, type HostPairing } from './host.entity';
import { HostsErrors } from './hosts.errors';

/**
 * The wire shapes of `apps/api`'s hosts module, mirrored from
 * `HostResponseDto` and `MintedPairingTokenResponseDto`. They are declared
 * here rather than imported because the generated SDK does not cover these
 * routes yet; regenerating `@oppenheimer/api-client` is what replaces them.
 */
interface HostDto {
  id: string;
  name: string;
  hostname?: string | null;
  os?: string | null;
  arch?: string | null;
  runnerVersion?: string | null;
  online: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
}

interface MintedPairingTokenDto {
  id: string;
  installCommand: string;
  agentPrompt: string;
  expiresAt: string;
  redeemedHostId?: string | null;
}

const HOSTS_URL = '/api/v1/hosts';

function toEntity(data: HostDto): HostEntity {
  return new HostEntity(
    data.id,
    data.name,
    data.online,
    data.hostname ?? null,
    data.os ?? null,
    data.arch ?? null,
    data.runnerVersion ?? null,
    data.lastSeenAt ? new Date(data.lastSeenAt) : null,
    new Date(data.createdAt),
  );
}

@injectable()
export class HostsRepository {
  @MapApiError(HostsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<HostEntity[]> {
    const { data, error } = await heyApiClient.get<HostDto[]>({ url: HOSTS_URL });
    // An absent body is a failed read, not an empty collection — returning `[]`
    // would render "no hosts" over a request that never succeeded.
    if (error || !data) throw new AppError(HostsErrors.FETCH_LIST_FAILED);
    return data.map(toEntity);
  }

  /**
   * Mint the registration token Add host pastes; the host appears once its
   * runner dials in.
   *
   * The machine is named before it exists, because the token carries the name
   * the runner will adopt. It can be renamed afterwards from Settings.
   */
  @MapApiError(HostsErrors.PAIR_FAILED)
  async pair(name: string): Promise<HostPairing> {
    const { data, error } = await heyApiClient.post<MintedPairingTokenDto>({
      url: `${HOSTS_URL}/pairing`,
      body: { name },
    });
    if (error || !data) throw new AppError(HostsErrors.PAIR_FAILED);
    return {
      id: data.id,
      installCommand: data.installCommand,
      agentPrompt: data.agentPrompt,
      expiresAt: new Date(data.expiresAt),
      redeemedHostId: data.redeemedHostId ?? null,
    };
  }

  @MapApiError(HostsErrors.REMOVE_FAILED)
  async remove(id: string): Promise<void> {
    const { error } = await heyApiClient.delete({ url: `${HOSTS_URL}/{id}`, path: { id } });
    if (error) throw new AppError(HostsErrors.REMOVE_FAILED);
  }
}
