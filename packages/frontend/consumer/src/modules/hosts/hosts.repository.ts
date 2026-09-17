import { heyApiClient } from '@oppenheimer/api-client';
import { AppError, MapApiError } from '@oppenheimer/frontend-core';
import { injectable } from 'inversify';
import { HostEntity, type HostPairing, type HostState } from './host.entity';
import { HostsErrors } from './hosts.errors';

/**
 * The wire shape of a host, as the control plane's `hosts` module will answer
 * it (`product/versions/mvp/03-control-plane.md`, data model: hosts,
 * host_keys). Declared here until the endpoints exist and the typed SDK in
 * `@oppenheimer/api-client` is regenerated from them; then this file switches
 * to `HostsApi` like every other repository and the DTOs below go.
 */
interface HostDto {
  id: string;
  name: string;
  state: HostState;
  lastSeenAt: string | null;
  createdAt: string;
}

interface HostPairingDto {
  installCommand: string;
  expiresAt: string;
}

const HOSTS_URL = '/api/v1/hosts';

function toEntity(data: HostDto): HostEntity {
  return new HostEntity(
    data.id,
    data.name,
    data.state,
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

  /** Mint the registration token Add host pastes; the host appears once its runner dials in. */
  @MapApiError(HostsErrors.PAIR_FAILED)
  async pair(): Promise<HostPairing> {
    const { data, error } = await heyApiClient.post<HostPairingDto>({
      url: `${HOSTS_URL}/pairing`,
    });
    if (error || !data) throw new AppError(HostsErrors.PAIR_FAILED);
    return { installCommand: data.installCommand, expiresAt: new Date(data.expiresAt) };
  }

  @MapApiError(HostsErrors.REMOVE_FAILED)
  async remove(id: string): Promise<void> {
    const { error } = await heyApiClient.delete({ url: `${HOSTS_URL}/{id}`, path: { id } });
    if (error) throw new AppError(HostsErrors.REMOVE_FAILED);
  }
}
